const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (HTML, CSS, JS, images, pdf)
app.use(express.static(__dirname));

const REGISTRATIONS_FILE = path.join(__dirname, 'registrations.json');
const USERS_FILE = path.join(__dirname, 'users.json');

// Initialize files if they don't exist
if (!fs.existsSync(REGISTRATIONS_FILE)) {
    fs.writeFileSync(REGISTRATIONS_FILE, JSON.stringify([]));
}
if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify({}));
}

// Helper to read JSON files safely
function readJSON(file) {
    try {
        const data = fs.readFileSync(file, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
}

// Helper to write JSON files
function writeJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

// ==========================================================================
// API Endpoints
// ==========================================================================

// 1. Register a student for a course/time slot
app.post('/api/register', (req, res) => {
    const { firstName, lastName, phoneNumber, slots, courseLevel, format, language, selectedLectures } = req.body;
    
    if (!firstName || !lastName || !phoneNumber) {
        return res.status(400).json({ error: 'Имя, фамилия и номер телефона обязательны' });
    }

    const registrations = readJSON(REGISTRATIONS_FILE);
    
    const newReg = {
        id: Date.now().toString(),
        firstName,
        lastName,
        phoneNumber,
        slots: slots || [],
        courseLevel: courseLevel || 'Не выбран',
        format: format || 'Не выбран',
        language: language || 'Не выбран',
        selectedLectures: selectedLectures || [],
        timestamp: new Date().toISOString()
    };
    
    registrations.push(newReg);
    writeJSON(REGISTRATIONS_FILE, registrations);

    // Automatically ensure user exists in users.json to track status
    const users = readJSON(USERS_FILE);
    if (!users[phoneNumber]) {
        users[phoneNumber] = {
            firstName,
            lastName,
            status: 'Не куплен',
            updatedAt: new Date().toISOString()
        };
        writeJSON(USERS_FILE, users);
    }

    res.json({ success: true, registration: newReg });
});

// 2. Get all registrations for admin
app.get('/api/registrations', (req, res) => {
    const registrations = readJSON(REGISTRATIONS_FILE);
    res.json(registrations);
});

// 3. Clear all registrations (for testing/resetting if needed)
app.post('/api/registrations/clear', (req, res) => {
    writeJSON(REGISTRATIONS_FILE, []);
    res.json({ success: true, message: 'Все заявки удалены' });
});

// 4. Get status of a user's course by phone
app.get('/api/user-status', (req, res) => {
    const phone = req.query.phone;
    if (!phone) {
        return res.status(400).json({ error: 'Требуется параметр phone' });
    }
    
    const users = readJSON(USERS_FILE);
    if (users[phone]) {
        return res.json({ status: users[phone].status, name: users[phone].firstName });
    } else {
        return res.json({ status: 'Не куплен', name: '' });
    }
});

// 5. Update user course status (admin only)
app.post('/api/user-status', (req, res) => {
    const { phoneNumber, status, firstName, lastName } = req.body;
    
    if (!phoneNumber || !status) {
        return res.status(400).json({ error: 'Номер телефона и статус обязательны' });
    }
    
    const users = readJSON(USERS_FILE);
    
    if (!users[phoneNumber]) {
        users[phoneNumber] = {
            firstName: firstName || 'Пользователь',
            lastName: lastName || '',
            status: status,
            updatedAt: new Date().toISOString()
        };
    } else {
        users[phoneNumber].status = status;
        if (firstName) users[phoneNumber].firstName = firstName;
        if (lastName) users[phoneNumber].lastName = lastName;
        users[phoneNumber].updatedAt = new Date().toISOString();
    }
    
    writeJSON(USERS_FILE, users);
    res.json({ success: true, user: users[phoneNumber] });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
