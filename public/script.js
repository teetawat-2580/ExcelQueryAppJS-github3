$(document).ready(function() {
    // Global Application State
    const state = {
        rawData: [],
        headers: [],
        filteredData: [],
        sheetNames: [],
        activeSheet: '',
        searchTerm: '',
        sortColumn: null,
        sortDirection: 'asc',
        currentPage: 1,
        pageSize: 50,
        sourceInfo: ''
    };

    // Load initial dataset from server
    loadExcelData();

    // Fetch Excel data from API endpoint
    function loadExcelData(sheetName = '', customUrl = '') {
        showLoadingState(true);
        let endpoint = `/api/excel-data`;
        const params = [];
        if (sheetName) params.push(`sheet=${encodeURIComponent(sheetName)}`);
        if (customUrl) params.push(`url=${encodeURIComponent(customUrl)}`);
        if (params.length > 0) endpoint += `?` + params.join('&');

        $.ajax({
            url: endpoint,
            type: 'GET',
            dataType: 'json',
            timeout: 5000,
            success: function(response) {
                processApiResponse(response);
            },
            error: function(xhr, status, error) {
                showErrorState('Dataset load timeout/error: ' + (xhr.responseJSON?.error || error || xhr.statusText || 'Server busy'));
            }
        });
    }

    // Process and update application state from API response
    function processApiResponse(response) {
        state.rawData = response.data || [];
        state.headers = response.headers || [];
        state.sheetNames = response.sheetNames || [];
        state.activeSheet = response.activeSheet || '';
        state.sourceInfo = response.sourceInfo || 'Spreadsheet Dataset';
        state.currentPage = 1;
        state.sortColumn = null;

        $('#sourceInfoLabel').text(state.sourceInfo);
        renderSheetTabs();
        applyFilterAndSort();
        showLoadingState(false);

        if (response.warning) {
            console.warn(response.warning);
        }
    }

    // Render Sheet Selector Tabs
    function renderSheetTabs() {
        const $container = $('#sheetTabs').empty();
        if (state.sheetNames.length <= 1) {
            $container.hide();
            return;
        }

        $container.show();
        state.sheetNames.forEach(name => {
            const $tab = $('<button>')
                .addClass('sheet-tab')
                .toggleClass('active', name === state.activeSheet)
                .text(name)
                .on('click', function() {
                    if (name !== state.activeSheet) {
                        loadExcelData(name);
                    }
                });
            $container.append($tab);
        });
    }

    // Filter, Sort, and Re-render Data
    function applyFilterAndSort() {
        const term = state.searchTerm.toLowerCase().trim();

        // 1. Filter
        if (!term) {
            state.filteredData = [...state.rawData];
        } else {
            state.filteredData = state.rawData.filter(row => {
                return state.headers.some(header => {
                    const val = (row[header] !== undefined && row[header] !== null) ? String(row[header]) : '';
                    return val.toLowerCase().includes(term);
                });
            });
        }

        // 2. Sort
        if (state.sortColumn) {
            const col = state.sortColumn;
            const dir = state.sortDirection === 'asc' ? 1 : -1;
            state.filteredData.sort((a, b) => {
                let valA = a[col] ?? '';
                let valB = b[col] ?? '';

                // Numeric sorting check
                const numA = Number(valA);
                const numB = Number(valB);
                if (!isNaN(numA) && !isNaN(numB) && valA !== '' && valB !== '') {
                    return (numA - numB) * dir;
                }

                return String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' }) * dir;
            });
        }

        // Update KPIs
        updateKpis();

        // Render Table & Pagination
        renderTable();
        renderPagination();
    }

    // Update Top KPI Stats
    function updateKpis() {
        $('#kpiTotalRows').text(state.rawData.length.toLocaleString());
        $('#kpiTotalCols').text(state.headers.length);
        $('#kpiActiveSheet').text(state.activeSheet || 'Sheet 1');
        $('#kpiFilteredRows').text(state.filteredData.length.toLocaleString());
    }

    // Render Table Header and Paginated Body Rows
    function renderTable() {
        const $thead = $('#dataTable thead').empty();
        const $tbody = $('#dataTable tbody').empty();

        if (state.headers.length === 0 || state.filteredData.length === 0) {
            if (!state.searchTerm) {
                $('#stateMessage').html('<p style="padding: 40px;">No data rows available in this sheet.</p>').show();
            } else {
                $('#stateMessage').html('<p style="padding: 40px;">No records found matching "<strong>' + escapeHtml(state.searchTerm) + '</strong>".</p>').show();
            }
            return;
        }

        $('#stateMessage').hide();

        // Create Headers
        const $headerRow = $('<tr>');
        state.headers.forEach(header => {
            const $th = $('<th>')
                .html(escapeHtml(header) + ' <span class="sort-icon"></span>')
                .on('click', function() {
                    if (state.sortColumn === header) {
                        state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
                    } else {
                        state.sortColumn = header;
                        state.sortDirection = 'asc';
                    }
                    applyFilterAndSort();
                });

            if (state.sortColumn === header) {
                $th.addClass(state.sortDirection === 'asc' ? 'sorted-asc' : 'sorted-desc');
            }
            $headerRow.append($th);
        });
        $thead.append($headerRow);

        // Paginate Rows
        const startIndex = (state.currentPage - 1) * state.pageSize;
        const pageRows = state.filteredData.slice(startIndex, startIndex + state.pageSize);

        pageRows.forEach(row => {
            const $tr = $('<tr>');
            state.headers.forEach(header => {
                const cellValue = (row[header] !== undefined && row[header] !== null) ? String(row[header]) : '';
                const $td = $('<td>');

                // Render Badge for Status columns
                if (/status|สถานะ/i.test(header) && cellValue) {
                    const lowerVal = cellValue.toLowerCase();
                    let badgeClass = 'badge-pending';
                    if (lowerVal.includes('complete') || lowerVal.includes('เสร็จ')) badgeClass = 'badge-completed';
                    else if (lowerVal.includes('ship') || lowerVal.includes('ส่ง')) badgeClass = 'badge-shipped';

                    $td.html(`<span class="badge-status ${badgeClass}">${escapeHtml(cellValue)}</span>`);
                } else if (state.searchTerm) {
                    // Highlight Matching Search Text
                    $td.html(highlightMatches(cellValue, state.searchTerm));
                } else {
                    $td.text(cellValue);
                }

                $tr.append($td);
            });
            $tbody.append($tr);
        });
    }

    // Highlight search match substring
    function highlightMatches(text, term) {
        if (!term || !text) return escapeHtml(text);
        const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedTerm})`, 'gi');
        return escapeHtml(text).replace(regex, '<span class="highlight">$1</span>');
    }

    // Render Pagination Controls
    function renderPagination() {
        const totalRows = state.filteredData.length;
        const totalPages = Math.ceil(totalRows / state.pageSize) || 1;
        state.currentPage = Math.min(Math.max(1, state.currentPage), totalPages);

        const start = totalRows === 0 ? 0 : (state.currentPage - 1) * state.pageSize + 1;
        const end = Math.min(state.currentPage * state.pageSize, totalRows);

        $('#paginationInfo').text(`Showing ${start}-${end} of ${totalRows} records`);
        $('#pageIndicator').text(`Page ${state.currentPage} of ${totalPages}`);

        $('#prevPageBtn').prop('disabled', state.currentPage <= 1);
        $('#nextPageBtn').prop('disabled', state.currentPage >= totalPages);
    }

    // Pagination Event Listeners
    $('#prevPageBtn').on('click', function() {
        if (state.currentPage > 1) {
            state.currentPage--;
            renderTable();
            renderPagination();
        }
    });

    $('#nextPageBtn').on('click', function() {
        const totalPages = Math.ceil(state.filteredData.length / state.pageSize);
        if (state.currentPage < totalPages) {
            state.currentPage++;
            renderTable();
            renderPagination();
        }
    });

    // Real-Time Search Handler with Debounce
    let searchTimeout = null;
    $('#searchBox').on('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            state.searchTerm = $(this).val();
            state.currentPage = 1;
            applyFilterAndSort();
        }, 150);
    });

    // Toggle Web URL Input Bar
    $('#toggleUrlBtn').on('click', function() {
        $('#urlBarContainer').slideToggle(200);
    });

    // Sync Remote URL Button Handler
    $('#syncUrlBtn').on('click', function() {
        const url = $('#remoteUrlInput').val().trim();
        if (!url) {
            alert('Please enter a valid OneDrive or public Excel URL.');
            return;
        }

        showLoadingState(true);
        $.ajax({
            url: '/api/fetch-url',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ url: url }),
            success: function(response) {
                processApiResponse(response);
                $('#urlBarContainer').slideUp(200);
            },
            error: function(xhr) {
                showErrorState('Failed to fetch from URL: ' + (xhr.responseJSON?.error || xhr.responseJSON?.details || xhr.statusText));
            }
        });
    });

    // Refresh Data Handler
    $('#refreshBtn').on('click', function() {
        loadExcelData(state.activeSheet);
    });

    // CSV Export Handler
    $('#exportCsvBtn').on('click', function() {
        if (state.filteredData.length === 0 || state.headers.length === 0) {
            alert('No data available to export.');
            return;
        }

        let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // UTF-8 BOM for Thai/Special characters support
        csvContent += state.headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(",") + "\n";

        state.filteredData.forEach(row => {
            const line = state.headers.map(h => {
                const val = (row[h] !== undefined && row[h] !== null) ? String(row[h]) : '';
                return `"${val.replace(/"/g, '""')}"`;
            }).join(",");
            csvContent += line + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Export_${state.activeSheet || 'Excel'}_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // File Upload Dialog Handlers
    $('#openUploadBtn').on('click', function() {
        $('#dropzoneOverlay').addClass('active');
    });

    $('#closeUploadBtn').on('click', function() {
        $('#dropzoneOverlay').removeClass('active');
    });

    $('#browseFileBtn').on('click', function() {
        $('#fileInput').click();
    });

    // File Input Change Upload
    $('#fileInput').on('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        uploadExcelFile(file);
    });

    // Drag and Drop Upload
    const $overlay = $('#dropzoneOverlay');
    $overlay.on('dragover dragenter', function(e) {
        e.preventDefault();
        e.stopPropagation();
    });

    $overlay.on('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const files = e.originalEvent.dataTransfer.files;
        if (files && files.length > 0) {
            uploadExcelFile(files[0]);
        }
    });

    // Upload File Function
    function uploadExcelFile(file) {
        const formData = new FormData();
        formData.append('excelFile', file);

        showLoadingState(true);
        $('#dropzoneOverlay').removeClass('active');

        $.ajax({
            url: '/api/upload',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                processApiResponse(response);
            },
            error: function(xhr) {
                const msg = xhr.responseJSON?.error || xhr.responseJSON?.details || (xhr.status === 413 ? 'File size exceeds 4.5MB limit for Vercel' : xhr.statusText) || 'Upload failed';
                showErrorState('Upload failed: ' + msg);
            }
        });
    }

    // UI State Helpers
    function showLoadingState(isLoading) {
        if (isLoading) {
            $('#stateMessage').html('<div class="spinner"></div><p>Processing spreadsheet data...</p>').show();
            $('#dataTable tbody').empty();
        }
    }

    function showErrorState(msg) {
        showLoadingState(false);
        $('#stateMessage').html(`<p style="color: var(--accent-danger); font-weight: 600;"><i class="fa-solid fa-triangle-exclamation"></i> ${escapeHtml(msg)}</p>`).show();
    }

    function escapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
});