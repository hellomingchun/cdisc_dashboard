document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const dropzoneSpecs = document.getElementById('dropzone-specs');
    const fileInputSpecs = document.getElementById('file-input-specs');
    const browseBtnSpecs = document.getElementById('browse-btn-specs');
    const filesListCardSpecs = document.getElementById('files-list-card-specs');
    const filesListSpecs = document.getElementById('files-list-specs');
    const fileCountBadgeSpecs = document.getElementById('file-count-specs');

    const dropzoneData = document.getElementById('dropzone-data');
    const fileInputData = document.getElementById('file-input-data');
    const browseBtnData = document.getElementById('browse-btn-data');
    const filesListCardData = document.getElementById('files-list-card-data');
    const filesListData = document.getElementById('files-list-data');
    const fileCountBadgeData = document.getElementById('file-count-data');
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
    let uploadedSpecs = [];
    let uploadedData = [];
    
    // SDTM Datasets built from API
    let sdtmData = {};

    // --- File Upload Logic ---
    function setupDropzone(dropzone, fileInput, browseBtn, validExtensions, listCard, listElement, countBadge, uploadedArray, updateCallback) {
        browseBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }

        ['dragenter', 'dragover'].forEach(eventName => {
            dropzone.addEventListener(eventName, () => dropzone.classList.add('dragover'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, () => dropzone.classList.remove('dragover'), false);
        });

        dropzone.addEventListener('drop', (e) => {
            handleFiles(e.dataTransfer.files);
        });

        function handleFiles(files) {
            const newFiles = Array.from(files);
            const validFiles = newFiles.filter(file => {
                const ext = file.name.split('.').pop().toLowerCase();
                return validExtensions.includes(ext);
            });
            
            if (validFiles.length < newFiles.length) {
                showToast(`Some files were rejected. Only ${validExtensions.join(', ')} are supported.`, 'warning');
            }
            
            if (validFiles.length > 0) {
                validFiles.forEach(f => uploadedArray.push(f));
                updateCallback();
                showToast(`Successfully added ${validFiles.length} file(s)`, 'success');
            }
        }
    }

    setupDropzone(dropzoneSpecs, fileInputSpecs, browseBtnSpecs, ['yaml', 'yml', 'json', 'xlsx'], filesListCardSpecs, filesListSpecs, fileCountBadgeSpecs, uploadedSpecs, updateUI);
    setupDropzone(dropzoneData, fileInputData, browseBtnData, ['xml', 'csv'], filesListCardData, filesListData, fileCountBadgeData, uploadedData, updateUI);

    function updateUI() {
        renderFileList(uploadedSpecs, filesListCardSpecs, filesListSpecs, fileCountBadgeSpecs, uploadedSpecs);
        renderFileList(uploadedData, filesListCardData, filesListData, fileCountBadgeData, uploadedData);
        
        if (uploadedSpecs.length > 0 || uploadedData.length > 0) {
            btnBuild.disabled = false;
        } else {
            btnBuild.disabled = true;
        }
    }

    function renderFileList(filesArray, listCard, listElement, countBadge, sourceArray) {
        if (filesArray.length > 0) {
            listCard.classList.remove('hidden');
        } else {
            listCard.classList.add('hidden');
        }
        
        countBadge.textContent = filesArray.length;
        listElement.innerHTML = '';
        
        filesArray.forEach((file, index) => {
            const li = document.createElement('li');
            li.className = 'file-item';
            
            const ext = file.name.split('.').pop().toLowerCase();
            let iconClass = 'fa-file-lines';
            if (ext === 'xlsx') iconClass = 'fa-file-excel';
            if (ext === 'json' || ext === 'xml') iconClass = 'fa-file-code';
            if (ext === 'csv') iconClass = 'fa-file-csv';
            
            li.innerHTML = `
                <div class="file-info">
                    <i class="fa-solid ${iconClass} file-icon"></i>
                    <span class="file-name" title="${file.name}">${file.name}</span>
                </div>
                <button class="btn-remove" data-index="${index}"><i class="fa-solid fa-xmark"></i></button>
            `;
            
            listElement.appendChild(li);
        });
        
        listElement.querySelectorAll('.btn-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = e.currentTarget.getAttribute('data-index');
                sourceArray.splice(index, 1);
                updateUI();
            });
        });
    }
    
    // --- Form Mapping Logic ---
    const mappingRowsContainer = document.getElementById('mapping-rows');
    const btnAddMapping = document.getElementById('btn-add-mapping');

    function createMappingRow(domain = '', formoid = '') {
        const row = document.createElement('div');
        row.className = 'mapping-row';
        row.innerHTML = `
            <input type="text" class="mapping-input domain-input" placeholder="Domain (e.g., DM)" value="${domain}" style="flex: 1;">
            <i class="fa-solid fa-arrow-right" style="color: var(--text-muted); font-size: 0.8rem;"></i>
            <input type="text" class="mapping-input formoid-input" placeholder="FormOID (e.g., F_1DEMOGRAPHIC)" value="${formoid}" style="flex: 2;">
            <button class="btn-remove btn-remove-mapping"><i class="fa-solid fa-xmark"></i></button>
        `;
        mappingRowsContainer.appendChild(row);

        row.querySelector('.btn-remove-mapping').addEventListener('click', () => {
            row.remove();
        });
    }

    // Initialize with one empty row
    createMappingRow();

    btnAddMapping.addEventListener('click', () => {
        createMappingRow();
    });

    // --- Build SDTM Logic ---
    
    btnBuild.addEventListener('click', async () => {
        if (uploadedSpecs.length === 0 && uploadedData.length === 0) return;

        // Show loading state
        const originalText = btnBuild.innerHTML;
        btnBuild.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Building...';
        btnBuild.disabled = true;
        
        try {
            const formData = new FormData();
            [...uploadedSpecs, ...uploadedData].forEach(file => {
                formData.append('files', file);
            });

            // Gather form mappings
            const formMappings = {};
            document.querySelectorAll('.mapping-row').forEach(row => {
                const domain = row.querySelector('.domain-input').value.trim().toUpperCase();
                const formoid = row.querySelector('.formoid-input').value.trim();
                if (domain && formoid) {
                    formMappings[domain] = formoid;
                }
            });

            if (Object.keys(formMappings).length > 0) {
                const mappingConfig = {
                    defaults: {
                        form_mapping: formMappings
                    }
                };
                const mappingBlob = new Blob([JSON.stringify(mappingConfig)], { type: 'application/json' });
                formData.append('files', mappingBlob, 'ui_form_mappings.yaml');
            }
            
            const response = await fetch('/api/build', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to build datasets');
            }
            
            sdtmData = data;
            
            // Switch UI states
            emptyState.classList.add('hidden');
            previewSection.classList.remove('hidden');
            
            // Update the tabs based on returned domains
            updateTabs(Object.keys(sdtmData));
            
            // Render first available domain
            const domains = Object.keys(sdtmData);
            if (domains.length > 0) {
                renderTable(domains[0]);
                showToast('SDTM datasets built successfully!', 'success');
            } else {
                showToast('No datasets generated.', 'warning');
            }
        } catch (error) {
            console.error(error);
            showToast(error.message, 'error');
        } finally {
            btnBuild.innerHTML = originalText;
            btnBuild.disabled = false;
        }
    });

    function updateTabs(domains) {
        const tabsContainer = document.querySelector('.domain-tabs');
        tabsContainer.innerHTML = ''; // clear existing tabs
        
        domains.forEach((domain, idx) => {
            const btn = document.createElement('button');
            btn.className = 'tab' + (idx === 0 ? ' active' : '');
            btn.setAttribute('data-domain', domain);
            btn.innerHTML = `<i class="fa-solid fa-table"></i> ${domain}`;
            
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                e.currentTarget.classList.add('active');
                renderTable(domain);
            });
            
            tabsContainer.appendChild(btn);
        });
    }
    
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
        const data = sdtmData[domain];
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
