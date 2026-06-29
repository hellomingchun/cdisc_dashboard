import sys
import tempfile
import shutil
import math
from pathlib import Path
from fastapi import FastAPI, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
import pandas as pd
import uvicorn

# Path to the local cdisc_builder package
CDISC_BUILDER_PATH = Path(__file__).parent.parent / "cdisc_builder" / "src"
sys.path.append(str(CDISC_BUILDER_PATH))

try:
    from cdiscbuilder.sdtm.sdtm import create_sdtm_datasets
    from cdiscbuilder.sdtm.odm_parser import parse_odm_to_long_df
    from cdiscbuilder.sdtm.loader.excel_parser import parse_excel_to_yaml_strings

except ImportError as e:
    print(f"Error importing cdiscbuilder: {e}")
    print(f"Make sure cdisc_builder is at {CDISC_BUILDER_PATH}")
    sys.exit(1)

app = FastAPI(title="SDTM Previewer API")

@app.post("/api/build")
async def build_sdtm(files: list[UploadFile] = File(...)):
    """Accepts uploaded spec files, runs cdisc_builder, and returns the dataset previews."""
    with tempfile.TemporaryDirectory() as temp_dir:
        specs_dir = Path(temp_dir) / "specs"
        specs_dir.mkdir()
        output_dir = Path(temp_dir) / "output"
        output_dir.mkdir()
        
        input_csv = None
        df = None
        raw_yaml_dict = {}
        
        # Save all uploaded configuration files and check for data files
        for file in files:
            ext = file.filename.split('.')[-1].lower()
            if ext == 'xml':
                # Parse XML to CSV
                xml_path = Path(temp_dir) / file.filename
                with open(xml_path, "wb") as buffer:
                    shutil.copyfileobj(file.file, buffer)
                
                df = parse_odm_to_long_df(str(xml_path))
                input_csv = Path(temp_dir) / "uploaded_odm_long.csv"
                df.to_csv(input_csv, index=False)
                
            elif ext == 'csv':
                # Use directly as CSV data
                input_csv = Path(temp_dir) / file.filename
                with open(input_csv, "wb") as buffer:
                    shutil.copyfileobj(file.file, buffer)
                    
            elif ext == 'xlsx':
                excel_path = Path(temp_dir) / file.filename
                with open(excel_path, "wb") as buffer:
                    shutil.copyfileobj(file.file, buffer)
                
                # Convert Excel sheets to YAML spec files but delay saving
                yaml_dict = parse_excel_to_yaml_strings(str(excel_path))
                raw_yaml_dict.update(yaml_dict)
                    
            elif ext in ['yaml', 'yml', 'json']:
                # Save as spec file
                file_path = specs_dir / file.filename
                with open(file_path, "wb") as buffer:
                    shutil.copyfileobj(file.file, buffer)

        # AI Mapping Step
        if raw_yaml_dict:
            if df is not None:
                from ai_mapper import ai_enhance_mappings
                enhanced_dict = ai_enhance_mappings(raw_yaml_dict, df)
            else:
                enhanced_dict = raw_yaml_dict
                
            for domain, yaml_str in enhanced_dict.items():
                yaml_file_path = specs_dir / f"{domain}.yaml"
                yaml_file_path.write_text(yaml_str)

        # Use the dummy ODM data if no data file was uploaded
        if input_csv is None:
            input_csv = CDISC_BUILDER_PATH.parent / "examples" / "data" / "odm_long.csv"
            if not input_csv.exists():
                return JSONResponse(
                    content={"error": f"Dummy CSV not found at {input_csv}"}, 
                    status_code=500
                )
                
        # Validate that we have at least one YAML file
        yaml_files = list(specs_dir.glob("*.yaml")) + list(specs_dir.glob("*.yml"))
        if not yaml_files:
            return JSONResponse(
                content={"error": "No YAML specifications were uploaded. The cdisc_builder engine currently requires .yaml configuration files."}, 
                status_code=400
            )
            
        try:
            # Run the engine
            create_sdtm_datasets(str(specs_dir), str(input_csv), str(output_dir))
            
            # Read output parquet files and convert to JSON format
            result = {}
            for pq_file in output_dir.glob("*.parquet"):
                domain = pq_file.stem
                df = pd.read_parquet(pq_file)
                
                # Replace NaNs with empty strings for valid JSON
                df = df.fillna("")
                
                result[domain] = {
                    "headers": df.columns.tolist(),
                    "rows": df.values.tolist()
                }
                
            return JSONResponse(content=result)
            
        except Exception as e:
            return JSONResponse(content={"error": str(e)}, status_code=500)

# Serve the static files (index.html, app.js, index.css)
app.mount("/", StaticFiles(directory=".", html=True), name="static")

if __name__ == "__main__":
    print("Starting SDTM Previewer Server...")
    print("Available at: http://localhost:8000")
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)

