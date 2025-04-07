$(document).ready(function() {
    // File upload handler
    $('#fileInput').change(function(e) {
      const file = e.target.files[0];
      if (!file) return;
  
      const formData = new FormData();
      formData.append('excelFile', file);
  
      $.ajax({
        url: '/upload',
        type: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        success: function(response) {
          renderTable(response.data);
          initializeSearch();
        },
        error: function(xhr) {
          alert('Error: ' + (xhr.responseJSON?.error || 'Upload failed'));
        }
      });
    });
  
    // Render table with all data
    function renderTable(data) {
      const $tbody = $('#dataTable tbody').empty();
      
      if (!data || data.length === 0) {
        $('#noResults').show().text('No data available');
        return;
      }
  
      data.forEach(row => {
        $tbody.append(`
          <tr>
            <td>${row.ID || ''}</td>
            <td class="emp-id">${row['รหัสพนักงาน'] || ''}</td>
            <td class="emp-name">${row['ชื่อ - นามสกุล พนักงาน'] || ''}</td>
            <td>${formatExcelDate(row['Start time'])}</td>
          </tr>
        `);
      });
    }
  
    // Excel date converter (optional)
    function formatExcelDate(excelSerial) {
      if (!excelSerial) return '';
      const date = new Date((excelSerial - 25569) * 86400 * 1000);
      return date.toLocaleString();
    }
  
    // Initialize search functionality
    function initializeSearch() {
      const $rows = $('#dataTable tbody tr');
      const $noResults = $('#noResults').hide();
  
      $('#searchBox').on('input', function() {
        const searchTerm = $(this).val().toLowerCase();
        let hasMatches = false;
  
        $rows.each(function() {
          const $row = $(this);
          const rowText = $row.text().toLowerCase();
          const isMatch = searchTerm === '' || rowText.includes(searchTerm);
          
          $row.toggle(isMatch);
          if (isMatch) hasMatches = true;
        });
  
        $noResults.toggle(!hasMatches && searchTerm !== '');
      });
    }
  
    // Load initial data if exists
    $.get('/api/data')
      .done(function(data) {
        if (!data.error && data.length > 0) {
          renderTable(data);
          initializeSearch();
        }
      })
      .fail(function() {
        console.log('No pre-loaded data found');
      });
  });