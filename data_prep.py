import pandas as pd
from pathlib import Path

def prepare_csv_data(input_csv_path, original_filename):
    """
    Reads a CSV file, detects if it is in wide format, and melts it to 
    long format if necessary. Overwrites the file in place.
    """
    try:
        tmp_df = pd.read_csv(input_csv_path)
        if 'ItemOID' not in tmp_df.columns or 'Value' not in tmp_df.columns:
            print(f"Wide CSV detected ({original_filename}), melting to long format...")
            id_col = next((col for col in ['SubjectKey', 'subject_id', 'USUBJID', 'SUBJID', 'ID'] if col in tmp_df.columns), tmp_df.columns[0])
            formoid_col = next((col for col in ['FormOID', 'form_id', 'Form'] if col in tmp_df.columns), None)
            studyoid_col = next((col for col in ['StudyOID', 'study_id', 'STUDYID'] if col in tmp_df.columns), None)
            
            id_vars = [id_col]
            if formoid_col: 
                id_vars.append(formoid_col)
            if studyoid_col:
                id_vars.append(studyoid_col)
                
            long_df = tmp_df.melt(id_vars=id_vars, var_name='ItemOID', value_name='Value')
            long_df = long_df.rename(columns={id_col: 'SubjectKey'})
            
            if formoid_col:
                long_df = long_df.rename(columns={formoid_col: 'FormOID'})
            else:
                domain_name = Path(original_filename).stem.upper().split('_')[0]
                long_df['FormOID'] = domain_name
                
            if studyoid_col:
                long_df = long_df.rename(columns={studyoid_col: 'StudyOID'})
            else:
                long_df['StudyOID'] = 'UNKNOWN_STUDY'
                
            # Also add other standard columns to prevent the builder from crashing
            if 'StudyEventOID' not in long_df.columns:
                long_df['StudyEventOID'] = 'SE_DEFAULT'
            if 'StudyEventRepeatKey' not in long_df.columns:
                long_df['StudyEventRepeatKey'] = 1
            if 'ItemGroupOID' not in long_df.columns:
                long_df['ItemGroupOID'] = 'IG_DEFAULT'
            if 'ItemGroupRepeatKey' not in long_df.columns:
                long_df['ItemGroupRepeatKey'] = 1
            if 'ItemName' not in long_df.columns:
                long_df['ItemName'] = long_df['ItemOID']
            if 'Question' not in long_df.columns:
                long_df['Question'] = long_df['ItemOID']
                
            long_df.to_csv(input_csv_path, index=False)
            print(f"Successfully converted {original_filename} to long format.")
    except Exception as e:
        print(f"Error checking/melting CSV {original_filename}: {e}")
