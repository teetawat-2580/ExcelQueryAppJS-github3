require('dotenv').config();
const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const cors = require('cors');
const path = require('path');
const axios = require('axios');

const app = express();

// Memory storage for fast and clean file uploads without disk pollution
const upload = multer({ 
    storage: multer.memoryStorage(), 
    limits: { fileSize: 25 * 1024 * 1024 } 
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(process.cwd(), 'public')));

// Default external feed (OneDrive download link)
const DEFAULT_ONEDRIVE_URL = process.env.ONEDRIVE_URL || 'https://onedrive.live.com/download?resid=AiZGf0GxzNdKjMsJ0UHlFy8sLRHLOg?e=2Ca30c';

// Helper: Convert Excel Serial Date or Date string into formatted locale string
function formatExcelValue(val, keyName = '') {
    if (val === null || val === undefined || val === '') return '';
    
    const isDateKey = keyName && /date|time|วันที่|เวลา/i.test(keyName);
    
    if (typeof val === 'number' && (isDateKey || (val > 20000 && val < 60000))) {
        try {
            const excelEpoch = new Date(1899, 11, 30);
            const days = Math.floor(val);
            const msFraction = (val - days) * 86400000;
            const date = new Date(excelEpoch.getTime() + (days - 1) * 86400000 + msFraction);
            
            if (!isNaN(date.getTime())) {
                const pad = num => num.toString().padStart(2, '0');
                const formatted = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
                return formatted.replace(' 00:00:00', '');
            }
        } catch (e) {
            // Return original if formatting fails
        }
    }
    
    if (val instanceof Date) {
        const pad = num => num.toString().padStart(2, '0');
        return `${pad(val.getDate())}/${pad(val.getMonth() + 1)}/${pad(val.getFullYear())}`;
    }

    return val;
}

// Helper: Parse workbook buffer into structured dataset
function parseWorkbookBuffer(buffer, requestedSheet) {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, raw: false });
    const sheetNames = workbook.SheetNames;

    if (!sheetNames || sheetNames.length === 0) {
        throw new Error('Workbook contains no sheets');
    }

    let activeSheet = requestedSheet && sheetNames.includes(requestedSheet) ? requestedSheet : null;
    if (!activeSheet) {
        const summaryMatch = sheetNames.find(n => n.toLowerCase().includes('summary'));
        activeSheet = summaryMatch || sheetNames[0];
    }

    const worksheet = workbook.Sheets[activeSheet];
    let rawData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    if (rawData.length === 0) {
        return {
            sheetNames,
            activeSheet,
            headers: [],
            data: [],
            totalRows: 0,
            totalCols: 0,
            isFallback: false
        };
    }

    const headers = Object.keys(rawData[0] || {});
    const data = rawData.map(row => {
        const formattedRow = {};
        headers.forEach(header => {
            formattedRow[header] = formatExcelValue(row[header], header);
        });
        return formattedRow;
    });

    return {
        sheetNames,
        activeSheet,
        headers,
        data,
        totalRows: data.length,
        totalCols: headers.length,
        isFallback: false
    };
}

// Demo Dataset for offline / preview fallback
function getFallbackDataset(targetSheet) {
    const salesSheet = [
        { "ID": "TX-1001", "Product": "Wireless Ergonomic Mouse", "Category": "Electronics", "Region": "North America", "Units Sold": 45, "Unit Price ($)": 29.99, "Total Sales ($)": 1349.55, "Completion time": "15/01/2026 14:30:00", "Status": "Completed" },
        { "ID": "TX-1002", "Product": "Mechanical Gaming Keyboard", "Category": "Electronics", "Region": "Europe", "Units Sold": 28, "Unit Price ($)": 89.50, "Total Sales ($)": 2506.00, "Completion time": "18/01/2026 09:15:00", "Status": "Completed" },
        { "ID": "TX-1003", "Product": "UltraWide 34\" Monitor", "Category": "Electronics", "Region": "Asia Pacific", "Units Sold": 12, "Unit Price ($)": 499.00, "Total Sales ($)": 5988.00, "Completion time": "20/01/2026 16:45:00", "Status": "Shipped" },
        { "ID": "TX-1004", "Product": "Ergonomic Mesh Desk Chair", "Category": "Furniture", "Region": "North America", "Units Sold": 15, "Unit Price ($)": 249.99, "Total Sales ($)": 3749.85, "Completion time": "22/01/2026 11:20:00", "Status": "Completed" },
        { "ID": "TX-1005", "Product": "Standing Desk Dual Motor", "Category": "Furniture", "Region": "Europe", "Units Sold": 8, "Unit Price ($)": 450.00, "Total Sales ($)": 3600.00, "Completion time": "25/01/2026 10:00:00", "Status": "Pending" },
        { "ID": "TX-1006", "Product": "Noise Cancelling Headphones", "Category": "Electronics", "Region": "Latin America", "Units Sold": 34, "Unit Price ($)": 199.99, "Total Sales ($)": 6799.66, "Completion time": "01/02/2026 15:10:00", "Status": "Completed" },
        { "ID": "TX-1007", "Product": "USB-C Multi-Port Hub 10-in-1", "Category": "Accessories", "Region": "Asia Pacific", "Units Sold": 65, "Unit Price ($)": 39.95, "Total Sales ($)": 2596.75, "Completion time": "03/02/2026 13:05:00", "Status": "Completed" },
        { "ID": "TX-1008", "Product": "4K Webcam with Dual Mic", "Category": "Electronics", "Region": "North America", "Units Sold": 22, "Unit Price ($)": 79.90, "Total Sales ($)": 1757.80, "Completion time": "05/02/2026 17:50:00", "Status": "Shipped" }
    ];

    const inventorySheet = [
        { "SKU": "SKU-E101", "Item Description": "Wireless Ergonomic Mouse", "Warehouse": "Aisle 4 - Shelf B", "Stock Level": 320, "Reorder Level": 50, "Supplier": "LogiTech Logistics", "Unit Cost ($)": 14.50 },
        { "SKU": "SKU-E102", "Item Description": "Mechanical Gaming Keyboard", "Warehouse": "Aisle 4 - Shelf C", "Stock Level": 145, "Reorder Level": 30, "Supplier": "Keytronics Inc.", "Unit Cost ($)": 42.00 },
        { "SKU": "SKU-E103", "Item Description": "UltraWide 34\" Monitor", "Warehouse": "Aisle 12 - Pallet 2", "Stock Level": 42, "Reorder Level": 10, "Supplier": "DisplayVision Co.", "Unit Cost ($)": 280.00 },
        { "SKU": "SKU-F201", "Item Description": "Ergonomic Mesh Desk Chair", "Warehouse": "Aisle 8 - Area A", "Stock Level": 65, "Reorder Level": 15, "Supplier": "ComfortFit Furniture", "Unit Cost ($)": 120.00 }
    ];

    const sheets = {
        "Sales Performance": salesSheet,
        "Inventory Overview": inventorySheet
    };

    const sheetNames = Object.keys(sheets);
    const activeSheet = (targetSheet && sheets[targetSheet]) ? targetSheet : sheetNames[0];
    const data = sheets[activeSheet];
    const headers = Object.keys(data[0] || {});

    return {
        sheetNames,
        activeSheet,
        headers,
        data,
        totalRows: data.length,
        totalCols: headers.length,
        isFallback: true,
        sourceInfo: "Interactive Sample Dataset"
    };
}

let currentMemoryDataset = null;

app.get('/api/excel-data', async (req, res) => {
    const targetSheet = req.query.sheet;
    const customUrl = req.query.url || DEFAULT_ONEDRIVE_URL;

    if (currentMemoryDataset && currentMemoryDataset.buffer) {
        try {
            const result = parseWorkbookBuffer(currentMemoryDataset.buffer, targetSheet);
            result.sourceInfo = currentMemoryDataset.sourceInfo;
            return res.json(result);
        } catch (e) {
            console.warn('Failed to parse cached memory dataset:', e.message);
        }
    }

    try {
        const response = await axios.get(customUrl, {
            responseType: 'arraybuffer',
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': '*/*'
            }
        });

        currentMemoryDataset = {
            buffer: response.data,
            sourceInfo: `OneDrive / Remote URL (${customUrl.includes('onedrive') ? 'OneDrive Live' : 'Web URL'})`
        };

        const result = parseWorkbookBuffer(response.data, targetSheet);
        result.sourceInfo = currentMemoryDataset.sourceInfo;
        return res.json(result);
    } catch (error) {
        console.warn('Primary fetch failed, loading interactive fallback dataset:', error.message);
        const fallback = getFallbackDataset(targetSheet);
        fallback.warning = `Could not load remote feed (${error.message}). Displaying sample dataset.`;
        return res.json(fallback);
    }
});

app.post('/upload', upload.single('excelFile'), (req, res) => {
    try {
        if (!req.file || !req.file.buffer) {
            return res.status(400).json({ error: 'No file was uploaded' });
        }

        const requestedSheet = req.query.sheet || req.body.sheet;
        currentMemoryDataset = {
            buffer: req.file.buffer,
            sourceInfo: `Uploaded File: ${req.file.originalname}`
        };

        const result = parseWorkbookBuffer(req.file.buffer, requestedSheet);
        result.success = true;
        result.sourceInfo = currentMemoryDataset.sourceInfo;
        return res.json(result);
    } catch (error) {
        console.error('File Upload Error:', error.message);
        return res.status(400).json({
            error: 'Failed to parse uploaded Excel file',
            details: error.message
        });
    }
});

app.post('/api/upload', upload.single('excelFile'), (req, res) => {
    try {
        if (!req.file || !req.file.buffer) {
            return res.status(400).json({ error: 'No file was uploaded' });
        }

        const requestedSheet = req.query.sheet || req.body.sheet;
        currentMemoryDataset = {
            buffer: req.file.buffer,
            sourceInfo: `Uploaded File: ${req.file.originalname}`
        };

        const result = parseWorkbookBuffer(req.file.buffer, requestedSheet);
        result.success = true;
        result.sourceInfo = currentMemoryDataset.sourceInfo;
        return res.json(result);
    } catch (error) {
        return res.status(400).json({
            error: 'Failed to parse uploaded file',
            details: error.message
        });
    }
});

app.post('/api/fetch-url', async (req, res) => {
    const { url, sheet } = req.body;
    if (!url) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }

    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 12000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Accept': '*/*'
            }
        });

        currentMemoryDataset = {
            buffer: response.data,
            sourceInfo: `External Web URL (${new URL(url).hostname})`
        };

        const result = parseWorkbookBuffer(response.data, sheet);
        result.sourceInfo = currentMemoryDataset.sourceInfo;
        return res.json(result);
    } catch (error) {
        return res.status(500).json({
            error: 'Failed to download Excel file from URL',
            details: error.message
        });
    }
});

module.exports = app;
