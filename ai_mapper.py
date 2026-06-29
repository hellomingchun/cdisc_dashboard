import os
import json
import yaml
import difflib
from cdiscbuilder.sdtm.odm_parser import extract_metadata_summary

def get_best_match(target_text, options, threshold=0.3):
    if not target_text or not options:
        return None
    
    best_match = None
    best_score = 0
    
    for opt in options:
        score = difflib.SequenceMatcher(None, target_text.lower(), opt['text'].lower()).ratio()
        if score > best_score and score > threshold:
            best_score = score
            best_match = opt['id']
            
    return best_match

def heuristic_auto_map(yaml_dict, xml_df):
    """
    Simulates the LLM's logic using semantic fuzzy matching.
    Used as a fallback when no LLM API key is present.
    """
    print("AI Mapper: Running heuristic semantic mapping...")
    meta_df = extract_metadata_summary(xml_df)
    
    # Build options list from ODM metadata
    options = []
    for _, row in meta_df.iterrows():
        text = f"{row.get('ItemName', '')} {row.get('Question', '')}"
        options.append({
            'id': row['ItemOID'],
            'text': text
        })

    enhanced_dict = {}
    for domain, yaml_str in yaml_dict.items():
        try:
            domain_spec = yaml.safe_load(yaml_str)
            if not isinstance(domain_spec, dict) or domain not in domain_spec:
                enhanced_dict[domain] = yaml_str
                continue
                
            block = domain_spec[domain][0]
            if 'formoid' not in block:
                block['formoid'] = domain
            columns = block.get('columns', {})
            
            for col, config in columns.items():
                if isinstance(config, dict) and not config.get('source'):
                    # Look for clues
                    derivation = config.get('derivation_rule', '')
                    desc = config.get('description', '')
                    
                    # LLM Simulated Logic: If it says 'Set to ...', it's a literal
                    if derivation.lower().startswith('set to'):
                        val = derivation.split("'")[-2] if "'" in derivation else derivation.split()[-1]
                        config['literal'] = val
                    
                    # Simulated Logic: If it mentions extracting from a form
                    elif 'extracted from ecrf' in derivation.lower() or 'extracted' in desc.lower():
                        match = get_best_match(derivation + " " + desc, options)
                        if match:
                            config['source'] = match
                            
                    # Simulated Logic: Hardcoded typical mappings for demo
                    if col == 'SUBJID' and not config.get('source'): config['source'] = 'SubjectKey'
                    if col == 'USUBJID' and not config.get('source'):
                        config['source'] = 'SubjectKey'
                        config['prefix'] = 'STX-2026-01-'
            
            enhanced_dict[domain] = yaml.dump(domain_spec, sort_keys=False)
        except Exception as e:
            print(f"Error in heuristic mapping for {domain}: {e}")
            enhanced_dict[domain] = yaml_str
            
    return enhanced_dict

_local_llm_pipeline = None

def get_local_llm_pipeline():
    global _local_llm_pipeline
    if _local_llm_pipeline is None:
        from transformers import pipeline
        import torch
        import os
        
        # Avoid fragmentation issues
        os.environ["PYTORCH_CUDA_ALLOC_CONF"] = "expandable_segments:True"
        
        print("Loading local LLM (Qwen3.6-35B-A3B), please wait...")
        device = 0 if torch.cuda.is_available() else -1
        
        _local_llm_pipeline = pipeline(
            "text-generation",
            model="Qwen/Qwen3.6-35B-A3B",
            torch_dtype=torch.float16,
            device=device,
        )
    return _local_llm_pipeline

def local_llm_auto_map(yaml_dict, xml_df):
    print("AI Mapper: Running local LLM mapping...")
    try:
        from transformers import pipeline
        import torch
    except ImportError:
        print("transformers or torch not installed. Run: uv pip install transformers torch accelerate")
        return heuristic_auto_map(yaml_dict, xml_df)
        
    try:
        pipe = get_local_llm_pipeline()
    except Exception as e:
        print(f"Failed to load LLM: {e}")
        return heuristic_auto_map(yaml_dict, xml_df)

    meta_df = extract_metadata_summary(xml_df)
    
    options_text = ""
    for _, row in meta_df.iterrows():
        options_text += f"- ID: {row['ItemOID']}, Label: {row.get('ItemName', '')}, Question: {row.get('Question', '')}\n"

    valid_ids = set(meta_df['ItemOID'].values)

    enhanced_dict = {}
    for domain, yaml_str in yaml_dict.items():
        try:
            domain_spec = yaml.safe_load(yaml_str)
            if not isinstance(domain_spec, dict) or domain not in domain_spec:
                enhanced_dict[domain] = yaml_str
                continue
                
            # Skip AI mapping if the uploaded data does not contain this domain
            if 'FormOID' in meta_df.columns:
                has_data = any(domain.upper() in str(f).upper() for f in meta_df['FormOID'].unique())
                if len(meta_df) > 0 and not has_data:
                    print(f"Skipping LLM mapping for {domain} because it is not present in the uploaded data.")
                    continue
                
            block = domain_spec[domain][0]
            if 'formoid' not in block:
                block['formoid'] = domain
            columns = block.get('columns', {})
            
            for col, config in columns.items():
                if isinstance(config, dict) and not config.get('source') and not config.get('literal'):
                    derivation = config.get('derivation_rule', '')
                    desc = config.get('description', '')
                    
                    mapped_context = {k: v for k, v in columns.items() if isinstance(v, dict) and (v.get('source') or v.get('literal'))}
                    import json
                    
                    # Ask the LLM to generate the entire mapping schema in JSON, passing prior context
                    messages = [
                        {"role": "system", "content": "You are a clinical data mapping AI. Translate variable rules into a JSON object with keys: 'source' (ODM Item ID), 'literal' (hardcoded string), or 'prefix' (string).\nRules:\n1. 'Set to X' -> {\"literal\": \"X\"}\n2. If concatenation of STUDYID and SUBJID is needed, check 'Already Mapped Variables' for STUDYID, and use it as a prefix: {\"source\": \"SubjectKey\", \"prefix\": \"<study_id>-\"}\n3. 'Extracted from eCRF' -> match ID -> {\"source\": \"XYZ_ID\"}\nOutput ONLY valid JSON. DO NOT wrap or nest the JSON inside the variable name. Output a flat object with only 'source', 'literal', or 'prefix' at the root level."},
                        {"role": "user", "content": f"Target Variable: {col}\nDescription: {desc}\nDerivation: {derivation}\nAlready Mapped Variables:\n{json.dumps(mapped_context)}\nAvailable ODM Items:\n- ID: SubjectKey, Label: Unique Subject ID\n{options_text}\n\nReturn the flat JSON mapping."}
                    ]
                    
                    try:
                        prompt = pipe.tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
                        outputs = pipe(prompt, max_new_tokens=60, max_length=None, do_sample=False, temperature=0.0)
                        generated_text = outputs[0]['generated_text'][len(prompt):].strip()
                        
                        # Clean markdown wrappers if LLM includes them
                        if generated_text.startswith('```json'):
                            generated_text = generated_text[7:-3].strip()
                        elif generated_text.startswith('```'):
                            generated_text = generated_text[3:-3].strip()
                            
                        llm_config = json.loads(generated_text)
                        
                        # Un-nest if the LLM wrapped the output in the column name
                        if col in llm_config and isinstance(llm_config[col], dict):
                            llm_config = llm_config[col]
                        elif len(llm_config) == 1 and isinstance(list(llm_config.values())[0], dict):
                            # Sometimes it wraps it in a random key
                            llm_config = list(llm_config.values())[0]
                        
                        # Fix tiny LLM hallucinations
                        if 'source' in llm_config and 'literal' in llm_config:
                            del llm_config['literal'] # Can't have both
                            
                        # Apply the LLM's dynamically learned mapping
                        for key in ['source', 'literal', 'prefix', 'function']:
                            if key in llm_config:
                                config[key] = llm_config[key]
                                
                        print(f"Local LLM learned mapping for {col}: {llm_config}")
                        
                    except Exception as e:
                        print(f"Local LLM JSON mapping failed for {col} ({e}), falling back to heuristic...")
                        if derivation.lower().startswith('set to'):
                            val = derivation.split("'")[-2] if "'" in derivation else derivation.split()[-1]
                            config['literal'] = val
                        elif 'extracted from ecrf' in derivation.lower() or 'extracted' in desc.lower():
                            match = get_best_match(derivation + " " + desc, [
                                {'id': r['ItemOID'], 'text': f"{r.get('ItemName', '')} {r.get('Question', '')}"} 
                                for _, r in meta_df.iterrows()
                            ])
                            if match:
                                config['source'] = match
            
            enhanced_dict[domain] = yaml.dump(domain_spec, sort_keys=False)
        except Exception as e:
            print(f"Error in LLM mapping for {domain}: {e}")
            enhanced_dict[domain] = yaml_str
            
    return enhanced_dict

def cloud_llm_auto_map(yaml_dict, xml_df, api_key):
    print("AI Mapper: Running cloud LLM mapping via Gemini...")
    try:
        import google.generativeai as genai
    except ImportError:
        print("google-generativeai not installed, falling back to local LLM.")
        return local_llm_auto_map(yaml_dict, xml_df)
        
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-1.5-flash')
    
    meta_df = extract_metadata_summary(xml_df)
    
    options_text = ""
    for _, row in meta_df.iterrows():
        options_text += f"- ID: {row['ItemOID']}, Label: {row.get('ItemName', '')}, Question: {row.get('Question', '')}\n"

    enhanced_dict = {}
    for domain, yaml_str in yaml_dict.items():
        try:
            domain_spec = yaml.safe_load(yaml_str)
            if not isinstance(domain_spec, dict) or domain not in domain_spec:
                enhanced_dict[domain] = yaml_str
                continue
                
            if 'FormOID' in meta_df.columns:
                has_data = any(domain.upper() in str(f).upper() for f in meta_df['FormOID'].unique())
                if len(meta_df) > 0 and not has_data:
                    print(f"Skipping LLM mapping for {domain} because it is not present in the uploaded data.")
                    continue
                    
            block = domain_spec[domain][0]
            if 'formoid' not in block:
                block['formoid'] = domain
            columns = block.get('columns', {})
            
            unmapped = {col: v for col, v in columns.items() if isinstance(v, dict) and not v.get('source') and not v.get('literal')}
            if not unmapped:
                enhanced_dict[domain] = yaml.dump(domain_spec, sort_keys=False)
                continue
                
            mapped_context = {k: v for k, v in columns.items() if isinstance(v, dict) and (v.get('source') or v.get('literal'))}
            
            prompt = f"""You are a clinical data mapping AI. 
Translate the following Target Variables into a JSON object where keys are the variable names, and values are mapping objects with keys: 'source' (ODM Item ID), 'literal' (hardcoded string), or 'prefix' (string).
Rules:
1. 'Set to X' -> {{"literal": "X"}}
2. If concatenation of STUDYID and SUBJID is needed, check 'Already Mapped Variables' for STUDYID, and use it as a prefix: {{"source": "SubjectKey", "prefix": "<study_id>-"}}
3. 'Extracted from eCRF' -> match ID -> {{"source": "XYZ_ID"}}

Already Mapped Variables:
{json.dumps(mapped_context)}

Available ODM Items:
- ID: SubjectKey, Label: Unique Subject ID
{options_text}

Target Variables to Map:
{json.dumps(unmapped, indent=2)}

Output ONLY a valid flat JSON dictionary mapping variable names to their config objects. Example: {{"USUBJID": {{"source": "SubjectKey", "prefix": "STX-1-"}}, "AESER": {{"source": "serious_event"}}}}"""
            
            response = model.generate_content(prompt)
            generated_text = response.text.strip()
            
            if generated_text.startswith('```json'):
                generated_text = generated_text[7:-3].strip()
            elif generated_text.startswith('```'):
                generated_text = generated_text[3:-3].strip()
                
            llm_config = json.loads(generated_text)
            print(f"Gemini mapped {domain} in one shot: {llm_config}")
            
            for col, config in llm_config.items():
                if col in columns:
                    if 'source' in config and 'literal' in config:
                        del config['literal']
                    for key in ['source', 'literal', 'prefix', 'function']:
                        if key in config:
                            columns[col][key] = config[key]
                            
            enhanced_dict[domain] = yaml.dump(domain_spec, sort_keys=False)
            
        except Exception as e:
            print(f"Gemini API mapping failed for {domain}: {e}")
            enhanced_dict[domain] = yaml_str
            
    return enhanced_dict

def ai_enhance_mappings(yaml_dict, xml_df):
    """
    Main entry point for AI Auto-Mapping.
    Attempts to call an LLM API (like Gemini or OpenAI) to map the specs.
    Falls back to local LLM or semantic heuristic matching if no API key is found.
    """
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("OPENAI_API_KEY")
    
    if not api_key:
        print("No AI API Key found. Attempting to use local LLM.")
        return local_llm_auto_map(yaml_dict, xml_df)
        
    print("AI API Key detected! Invoking Gemini API for auto-mapping...")
    return cloud_llm_auto_map(yaml_dict, xml_df, api_key)
