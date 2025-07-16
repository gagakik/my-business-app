// server.js - თქვენი Express.js სერვერის მთავარი ფაილი

// საჭირო მოდულების იმპორტი
const express = require('express'); // Express.js ვებ-ფრეიმვორკი
const { Pool } = require('pg'); // PostgreSQL კლიენტი Node.js-ისთვის
const bcrypt = require('bcryptjs'); // პაროლის ჰეშირების ბიბლიოთეკა
const jwt = require('jsonwebtoken'); // JSON Web Token ბიბლიოთეკა
require('dotenv').config(); // გარემოს ცვლადების ჩატვირთვა .env ფაილიდან

// Express აპლიკაციის ინიციალიზაცია
const app = express();
const port = 3000; // სერვერის პორტი

// JWT საიდუმლო გასაღები - შეცვალეთ ეს ძლიერი, უნიკალური სტრიქონით!
// რეკომენდებულია მისი შენახვა .env ფაილში: JWT_SECRET=your_super_secret_key
const jwtSecret = process.env.JWT_SECRET || 'your_very_secret_jwt_key';

// შენიშვნა: PostgreSQL-ის კონფიგურაცია
// დარწმუნდით, რომ PostgreSQL გაშვებულია თქვენს ლოკალურ მანქანაზე.
// შეცვალეთ ეს პარამეტრები თქვენი PostgreSQL კონფიგურაციის მიხედვით.
const pool = new Pool({
    user: process.env.DB_USER || 'postgres', // მომხმარებლის სახელი .env-დან ან ნაგულისხმევი
    host: process.env.DB_HOST || 'localhost',        // სერვერის მისამართი .env-დან ან ნაგულისხმევი
    database: process.env.DB_NAME || 'my_business_db', // მონაცემთა ბაზის სახელი .env-დან ან ნაგულისხმევი
    password: process.env.DB_PASSWORD || 'Sami4xuti', // პაროლი .env-დან ან ნაგულისხმევი
    port: process.env.DB_PORT || 5432,               // პორტი .env-დან ან ნაგულისხმევი
});

// მონაცემთა ბაზასთან კავშირის ტესტირება
pool.connect((err, client, release) => {
    if (err) {
        // თუ შეცდომაა კავშირის დროს, დაბეჭდეთ შეცდომა და გადით
        return console.error('Error acquiring client', err.stack);
    }
    // თუ კავშირი წარმატებულია, დაბეჭდეთ შეტყობინება
    console.log('Connected to PostgreSQL database!');
    // გაათავისუფლეთ კლიენტი პულში დასაბრუნებლად
    release();
});

// შუალედური პროგრამა (Middleware) JSON მოთხოვნების დასამუშავებლად
app.use(express.json());

// --- ავთენტიფიკაციის შუალედური პროგრამა ---
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    // Bearer TOKEN_STRING
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        return res.status(401).json({ message: 'ავტორიზაციის ტოკენი არ არის მოწოდებული' });
    }

    jwt.verify(token, jwtSecret, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'არასწორი ან ვადაგასული ტოკენი' });
        }
        req.user = user; // მომხმარებლის ინფორმაცია (id, role) ხელმისაწვდომია req.user-ში
        next();
    });
}

// --- ავტორიზაციის შუალედური პროგრამა (როლების შემოწმება) ---
function authorizeRoles(roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'არ გაქვთ ამ მოქმედების შესრულების უფლება' });
        }
        next();
    };
}

// --- მარშრუტები ---

// მარშრუტი მთავარი გვერდისთვის
app.get('/', (req, res) => {
    res.send('მოგესალმებით თქვენს ბიზნეს აპლიკაციის Backend-ზე!');
});

// მომხმარებლის რეგისტრაცია
app.post('/register', async (req, res) => {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: 'მომხმარებლის სახელი, ელფოსტა და პაროლი სავალდებულოა' });
    }

    try {
        // შეამოწმეთ, არსებობს თუ არა მომხმარებელი უკვე
        const existingUser = await pool.query('SELECT * FROM users WHERE username = $1 OR email = $2', [username, email]);
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ error: 'მომხმარებელი ამ სახელით ან ელფოსტით უკვე არსებობს' });
        }

        // პაროლის ჰეშირება
        const hashedPassword = await bcrypt.hash(password, 10); // 10 არის მარილის რაუნდების რაოდენობა

        // მომხმარებლის როლი (ნაგულისხმევად 'individual_user', თუ არ არის მითითებული ან არასწორია)
        const userRole = ['admin', 'company_user', 'individual_user', 'exhibition_manager'].includes(role) ? role : 'individual_user';

        // მომხმარებლის დამატება მონაცემთა ბაზაში
        const result = await pool.query(
            'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role, created_at',
            [username, email, hashedPassword, userRole]
        );
        res.status(201).json({ message: 'მომხმარებელი წარმატებით დარეგისტრირდა', user: result.rows[0] });
    } catch (err) {
        console.error('Error during registration:', err.stack);
        res.status(500).json({ error: 'რეგისტრაციის შეცდომა' });
    }
});

// მომხმარებლის შესვლა
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'მომხმარებლის სახელი და პაროლი სავალდებულოა' });
    }

    try {
        // მომხმარებლის მოძიება მონაცემთა ბაზაში
        const userResult = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = userResult.rows[0];

        if (!user) {
            return res.status(401).json({ error: 'არასწორი მომხმარებლის სახელი ან პაროლი' });
        }

        // პაროლის შედარება
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);

        if (!isPasswordValid) {
            return res.status(401).json({ error: 'არასწორი მომხმარებლის სახელი ან პაროლი' });
        }

        // JWT ტოკენის გენერირება
        const token = jwt.sign(
            { id: user.id, role: user.role },
            jwtSecret,
            { expiresIn: '1h' } // ტოკენი ვალიდურია 1 საათის განმავლობაში
        );

        res.json({ message: 'წარმატებული შესვლა', token: token, user: { id: user.id, username: user.username, email: user.email, role: user.role } });
    } catch (err) {
        console.error('Error during login:', err.stack);
        res.status(500).json({ error: 'შესვლის შეცდომა' });
    }
});

// --- დაცული მარშრუტის მაგალითი (მხოლოდ ავთენტიფიცირებული მომხმარებლებისთვის) ---
app.get('/profile', authenticateToken, (req, res) => {
    // req.user შეიცავს მომხმარებლის id-ს და role-ს ტოკენიდან
    res.json({ message: `მოგესალმებით, ${req.user.role} მომხმარებელო!`, user: req.user });
});

// --- როლით დაცული მარშრუტის მაგალითი (მხოლოდ ადმინებისთვის) ---
app.get('/admin-dashboard', authenticateToken, authorizeRoles(['admin']), (req, res) => {
    res.json({ message: 'მოგესალმებით ადმინისტრატორის დაფაზე!', user: req.user });
});

// --- როლით დაცული მარშრუტის მაგალითი (ადმინებისთვის და კომპანიის მომხმარებლებისთვის) ---
app.get('/company-data', authenticateToken, authorizeRoles(['admin', 'company_user']), (req, res) => {
    res.json({ message: 'კომპანიის მონაცემები ხელმისაწვდომია!', user: req.user });
});

// --- არსებული /users მარშრუტის დაცვა (მხოლოდ ადმინებისთვის) ---
// მომხმარებლების მიღება PostgreSQL-დან (ახლა დაცულია)
app.get('/users', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    try {
        const result = await pool.query('SELECT id, username, email, role, created_at, updated_at FROM users');
        res.json(result.rows);
    } catch (err) {
        console.error('Error executing query', err.stack);
        res.status(500).json({ error: 'მონაცემების მიღების შეცდომა' });
    }
});

// ახალი მომხმარებლის დამატება (ახლა დაცულია და როლის მინიჭება ხდება რეგისტრაციის დროს)
// ეს endpoint შეიძლება გამოყენებულ იქნას ადმინის მიერ ახალი მომხმარებლების ხელით დასამატებლად
app.post('/users', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: 'მომხმარებლის სახელი, ელფოსტა და პაროლი სავალდებულოა' });
    }

    try {
        const existingUser = await pool.query('SELECT * FROM users WHERE username = $1 OR email = $2', [username, email]);
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ error: 'მომხმარებელი ამ სახელით ან ელფოსტით უკვე არსებობს' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const userRole = ['admin', 'company_user', 'individual_user', 'exhibition_manager'].includes(role) ? role : 'individual_user';

        const result = await pool.query(
            'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role',
            [username, email, hashedPassword, userRole]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error executing insert query', err.stack);
        res.status(500).json({ error: 'მომხმარებლის დამატების შეცდომა' });
    }
});


// სერვერის გაშვება
app.listen(port, () => {
    console.log(`სერვერი გაშვებულია http://localhost:${port}-ზე`);
});



