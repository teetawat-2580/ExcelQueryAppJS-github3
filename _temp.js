// Update your upload function
async function uploadFile() {
    const fileInput = document.getElementById('excelFile');
    const statusElement = document.getElementById('uploadStatus');
    
    if (!fileInput.files.length) {
        statusElement.textContent = 'Please select a file';
        return;
    }
    
    // Add file validation
    const file = fileInput.files[0];
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        statusElement.textContent = 'Please upload an Excel file (.xlsx or .xls)';
        return;
    }

    const formData = new FormData();
    formData.append('excelFile', file);
    
    try {
        // Show upload progress
        statusElement.textContent = 'Uploading...';
        
        const response = await fetch('http://YOUR_SERVER_IP:3000/upload', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        statusElement.textContent = data.message || 'Upload successful';
    } catch (error) {
        console.error('Upload error:', error);
        statusElement.textContent = `Error: ${error.message}`;
    }
}