# CDISC Studio - SDTM Previewer

A premium standalone web application interface designed to upload clinical study specifications and preview SDTM datasets interactively.

## Features
- **Drag & Drop Upload:** Easily upload your YAML, JSON, or Excel specifications.
- **Interactive Preview:** Visualize resulting datasets (DM, AE, VS, LB, etc.) dynamically with filtering and pagination.
- **Dynamic Theming:** Modern, responsive interface with a dark/light mode toggle.
- **Backend Integration:** Connects directly to the `cdisc_builder` python package to dynamically generate datasets from uploaded specifications using sample ODM data.
- **Standalone Architecture:** Decoupled front-end validation allowing rapid iteration of mapping rules before formal production execution.

## Requirements
- Python 3.9+
- `cdisc_builder` package (must be located alongside this repository as `../cdisc_builder`)
- FastAPI and Uvicorn for the backend server

## Usage
1. Install the necessary dependencies:
   ```bash
   pip install -r requirements.txt
   ```
2. Start the local server:
   ```bash
   python server.py
   ```
3. Open your browser and navigate to `http://localhost:8000`
4. Upload your YAML or JSON mapping specifications and click **Build SDTM** to see the real outputs from the engine!

## Version
Current Version: **v1.2.0**
