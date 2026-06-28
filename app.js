document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const browseBtn = document.getElementById('browse-btn');
    const filesListCard = document.getElementById('files-list-card');
    const filesList = document.getElementById('files-list');
    const fileCountBadge = document.getElementById('file-count');
    const btnBuild = document.getElementById('btn-build');
    const emptyState = document.getElementById('empty-state');
    const previewSection = document.getElementById('preview-section');
    const sdtmTable = document.getElementById('sdtm-table');
    const tabs = document.querySelectorAll('.tab');
    const themeToggle = document.getElementById('theme-toggle');
    
    // --- Theme Toggle Logic ---
    const root = document.documentElement;
    const themeIcon = themeToggle.querySelector('i');

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        root.classList.add('light-theme');
        themeIcon.classList.replace('fa-sun', 'fa-moon');
    }

    themeToggle.addEventListener('click', () => {
        root.classList.toggle('light-theme');
        const isLight = root.classList.contains('light-theme');
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
        
        if (isLight) {
            themeIcon.classList.replace('fa-sun', 'fa-moon');
        } else {
            themeIcon.classList.replace('fa-moon', 'fa-sun');
        }
    });

    // State
    let uploadedFiles = [];
    
    // Mock Data for Preview
    const mockData = {
        'DM': {
            headers: ['STUDYID', 'DOMAIN', 'USUBJID', 'SUBJID', 'RFSTDTC', 'RFENDTC', 'SITEID', 'BRTHDTC', 'AGE', 'AGEU', 'SEX', 'RACE', 'ETHNIC', 'ARMCD', 'ARM'],
            rows: [
                ['CDISC01', 'DM', 'CDISC01-1001', '1001', '2023-01-15', '2023-06-20', '100', '1980-05-12', '42', 'YEARS', 'M', 'WHITE', 'NOT HISPANIC OR LATINO', 'TRT', 'Treatment'],
                ['CDISC01', 'DM', 'CDISC01-1002', '1002', '2023-01-18', '2023-06-25', '100', '1975-11-23', '47', 'YEARS', 'F', 'ASIAN', 'NOT HISPANIC OR LATINO', 'PBO', 'Placebo'],
                ['CDISC01', 'DM', 'CDISC01-1003', '1003', '2023-02-05', '2023-07-10', '101', '1990-02-28', '33', 'YEARS', 'M', 'BLACK OR AFRICAN AMERICAN', 'NOT HISPANIC OR LATINO', 'TRT', 'Treatment'],
                ['CDISC01', 'DM', 'CDISC01-1004', '1004', '2023-02-12', '2023-07-18', '101', '1965-08-14', '57', 'YEARS', 'F', 'WHITE', 'HISPANIC OR LATINO', 'PBO', 'Placebo'],
                ['CDISC01', 'DM', 'CDISC01-1005', '1005', '2023-03-01', '', '102', '1988-12-05', '34', 'YEARS', 'M', 'ASIAN', 'NOT HISPANIC OR LATINO', 'TRT', 'Treatment']
            ]
        },
        'AE': {
            headers: ['STUDYID', 'DOMAIN', 'USUBJID', 'AESEQ', 'AETERM', 'AEDECOD', 'AEBODSYS', 'AESEV', 'AESER', 'AESTDTC', 'AEENDTC'],
            rows: [
                ['CDISC01', 'AE', 'CDISC01-1001', '1', 'HEADACHE', 'HEADACHE', 'NERVOUS SYSTEM DISORDERS', 'MILD', 'N', '2023-02-10', '2023-02-12'],
                ['CDISC01', 'AE', 'CDISC01-1001', '2', 'NAUSEA', 'NAUSEA', 'GASTROINTESTINAL DISORDERS', 'MODERATE', 'N', '2023-03-05', '2023-03-08'],
                ['CDISC01', 'AE', 'CDISC01-1002', '1', 'FATIGUE', 'FATIGUE', 'GENERAL DISORDERS', 'MILD', 'N', '2023-01-25', '2023-02-05'],
                ['CDISC01', 'AE', 'CDISC01-1004', '1', 'DIZZINESS', 'DIZZINESS', 'NERVOUS SYSTEM DISORDERS', 'SEVERE', 'Y', '2023-04-12', '2023-04-15']
            ]
        },
        'VS': {
            headers: ['STUDYID', 'DOMAIN', 'USUBJID', 'VSSEQ', 'VSTESTCD', 'VSTEST', 'VSORRES', 'VSORRESU', 'VSSTRESC', 'VSSTRESN', 'VSSTRESU', 'VISIT', 'VSDTC'],
            rows: [
                ['CDISC01', 'VS', 'CDISC01-1001', '1', 'SYSBP', 'Systolic Blood Pressure', '120', 'mmHg', '120', '120', 'mmHg', 'SCREENING', '2023-01-10'],
                ['CDISC01', 'VS', 'CDISC01-1001', '2', 'DIABP', 'Diastolic Blood Pressure', '80', 'mmHg', '80', '80', 'mmHg', 'SCREENING', '2023-01-10'],
                ['CDISC01', 'VS', 'CDISC01-1001', '3', 'WEIGHT', 'Weight', '75', 'kg', '75', '75', 'kg', 'SCREENING', '2023-01-10']
            ]
        },
        'LB': {
            headers: ['STUDYID', 'DOMAIN', 'USUBJID', 'LBSEQ', 'LBTESTCD', 'LBTEST', 'LBCAT', 'LBORRES', 'LBORRESU', 'LBSTRESC', 'LBSTRESN', 'LBSTRESU', 'VISIT'],
            rows: [
                ['CDISC01', 'LB', 'CDISC01-1001', '1', 'GLUC', 'Glucose', 'CHEMISTRY', '95', 'mg/dL', '5.27', '5.27', 'mmol/L', 'SCREENING'],
                ['CDISC01', 'LB', 'CDISC01-1001', '2', 'ALT', 'Alanine Aminotransferase', 'CHEMISTRY', '25', 'U/L', '25', '25', 'U/L', 'SCREENING'],
                ['CDISC01', 'LB', 'CDISC01-1002', '1', 'HGB', 'Hemoglobin', 'HEMATOLOGY', '14.2', 'g/dL', '142', '142', 'g/L', 'SCREENING']
            ]
        }
    };

    // --- File Upload Logic ---
    
    // Browse click
    browseBtn.addEventListener('click', () => fileInput.click());
    
    // File Input change
    fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
    
    // Drag & Drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => dropzone.classList.add('dragover'), false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => dropzone.classList.remove('dragover'), false);
    });
    
    dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        handleFiles(dt.files);
    });
    
    function handleFiles(files) {
        const newFiles = Array.from(files);
        
        // Filter out non-supported files
        const validFiles = newFiles.filter(file => {
            const ext = file.name.split('.').pop().toLowerCase();
            return ['yaml', 'yml', 'json', 'xlsx'].includes(ext);
        });
        
        if (validFiles.length < newFiles.length) {
            showToast('Some files were rejected. Only .yaml, .json, and .xlsx are supported.', 'warning');
        }
        
        if (validFiles.length > 0) {
            uploadedFiles = [...uploadedFiles, ...validFiles];
            updateFilesUI();
            showToast(`Successfully added ${validFiles.length} file(s)`, 'success');
        }
    }
    
    function updateFilesUI() {
        if (uploadedFiles.length > 0) {
            filesListCard.classList.remove('hidden');
            btnBuild.disabled = false;
        } else {
            filesListCard.classList.add('hidden');
            btnBuild.disabled = true;
        }
        
        fileCountBadge.textContent = uploadedFiles.length;
        filesList.innerHTML = '';
        
        uploadedFiles.forEach((file, index) => {
            const li = document.createElement('li');
            li.className = 'file-item';
            
            const ext = file.name.split('.').pop().toLowerCase();
            let iconClass = 'fa-file-lines';
            if (ext === 'xlsx') iconClass = 'fa-file-excel';
            if (ext === 'json') iconClass = 'fa-file-code';
            
            li.innerHTML = `
                <div class="file-info">
                    <i class="fa-solid ${iconClass} file-icon"></i>
                    <span class="file-name" title="${file.name}">${file.name}</span>
                </div>
                <button class="btn-remove" data-index="${index}"><i class="fa-solid fa-xmark"></i></button>
            `;
            
            filesList.appendChild(li);
        });
        
        // Add remove listeners
        document.querySelectorAll('.btn-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = e.currentTarget.getAttribute('data-index');
                uploadedFiles.splice(index, 1);
                updateFilesUI();
            });
        });
    }
    
    // --- Build SDTM Logic ---
    
    btnBuild.addEventListener('click', () => {
        // Show loading state
        const originalText = btnBuild.innerHTML;
        btnBuild.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Building...';
        btnBuild.disabled = true;
        
        // Simulate API call processing time
        setTimeout(() => {
            btnBuild.innerHTML = originalText;
            btnBuild.disabled = false;
            
            // Switch UI states
            emptyState.classList.add('hidden');
            previewSection.classList.remove('hidden');
            
            // Render default domain
            renderTable('DM');
            showToast('SDTM datasets built successfully!', 'success');
        }, 1500);
    });
    
    // --- Tabs & Table Rendering ---
    
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            tabs.forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            
            const domain = e.target.getAttribute('data-domain');
            renderTable(domain);
        });
    });
    
    function renderTable(domain) {
        const data = mockData[domain];
        if (!data) return;
        
        const thead = sdtmTable.querySelector('thead');
        const tbody = sdtmTable.querySelector('tbody');
        
        // Render Headers
        thead.innerHTML = `<tr>${data.headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
        
        // Render Rows with staggered animation
        tbody.innerHTML = '';
        data.rows.forEach((row, i) => {
            const tr = document.createElement('tr');
            tr.style.animationDelay = `${i * 0.05}s`;
            tr.innerHTML = row.map(cell => `<td>${cell || '<span class="text-muted">-</span>'}</td>`).join('');
            tbody.appendChild(tr);
        });
        
        // Update record count
        document.querySelector('.record-count').textContent = `Showing 1-${data.rows.length} of ${data.rows.length} records`;
    }
    
    // --- Toast Notifications ---
    
    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = type === 'success' ? 'fa-circle-check' : (type === 'error' ? 'fa-circle-exclamation' : 'fa-triangle-exclamation');
        
        toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease forwards';
            setTimeout(() => {
                if(container.contains(toast)) container.removeChild(toast);
            }, 300);
        }, 3000);
    }

});
