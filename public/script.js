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
          renderTable(response.data, response.headers);
          initializeSearch();
        },
        error: function(xhr) {
          alert('Upload failed: ' + (xhr.responseJSON?.error || 'Unknown error'));
        }
      });
    });
  
    // Render table with dynamic columns
    function renderTable(data, headers) {
      const $thead = $('#dataTable thead').empty();
      const $tbody = $('#dataTable tbody').empty();
      
      // Create header row
      const $headerRow = $('<tr>');
      headers.forEach(header => {
        $headerRow.append($('<th>').text(header));
      });
      $thead.append($headerRow);
  
      // Create data rows
      if (!data || data.length === 0) {
        $('#noResults').show().text('No data available');
        return;
      }
  
      data.forEach(row => {
        const $row = $('<tr>');
        headers.forEach(header => {
          $row.append($('<td>').text(row[header] || ''));
        });
        $tbody.append($row);
      });
    }
  
    // Initialize search functionality
    function initializeSearch() {
      const $rows = $('#dataTable tbody tr');
      const $noResults = $('#noResults').hide();
  
      $('#searchBox').on('input', function() {
        const searchTerm = $(this).val().toLowerCase().trim();
        let hasMatches = false;
  
        $rows.each(function() {
          const $row = $(this);
          let rowText = '';
          
          // Concatenate all cell text for searching
          $(this).find('td').each(function() {
            rowText += $(this).text().toLowerCase() + ' ';
          });
  
          const isMatch = searchTerm === '' || rowText.includes(searchTerm);
          $row.toggle(isMatch);
          if (isMatch) hasMatches = true;
          
          // Highlight matching text
          if (isMatch && searchTerm !== '') {
            highlightText($row, searchTerm);
          } else {
            removeHighlights($row);
          }
        });
  
        $noResults.toggle(!hasMatches && searchTerm !== '');
      });
    }
  
    // Highlight matching text
    function highlightText($row, searchTerm) {
      $row.find('td').each(function() {
        const text = $(this).text();
        const regex = new RegExp(searchTerm, 'gi');
        const highlighted = text.replace(regex, match => 
          `<span class="highlight">${match}</span>`
        );
        $(this).html(highlighted);
      });
    }
  
    // Remove highlights
    function removeHighlights($row) {
      $row.find('td').each(function() {
        const text = $(this).text();
        $(this).text(text);
      });
    }
  
    // Load initial data if exists
    $.get('/api/data')
      .done(function(response) {
        if (response.data && response.data.length > 0) {
          renderTable(response.data, response.headers);
          initializeSearch();
        }
      })
      .fail(function() {
        console.log('No pre-loaded data found');
      });
  });