// server.js - თქვენი Express.js სერვერის მთავარი ფაილი

// საჭირო მოდულების იმპორტი
const express = require('express'); // Express.js ვებ-ფრეიმვორკი
const { Pool } = require('pg'); // PostgreSQL კლიენტი Node.js-ისთვის

// Express აპლიკაციის ინიციალიზაცია
const app = express();
const port = 3000; // სერვერის პორტი

// შენიშვნა: PostgreSQL-ის კონფიგურაცია
// დარწმუნდით, რომ PostgreSQL გაშვებულია თქვენს ლოკალურ მანქანაზე.
// შეცვალეთ ეს პარამეტრები თქვენი PostgreSQL კონფიგურაციის მიხედვით.
const pool = new Pool({
    user: 'postgres', // თქვენი PostgreSQL მომხმარებლის სახელი (განახლებულია)
    host: 'localhost',        // PostgreSQL სერვერის მისამართი (ლოკალური)
    database: 'my_business_db', // თქვენი მონაცემთა ბაზის სახელი (განახლებულია)
    password: 'Sami4xuti', // თქვენი PostgreSQL პაროლი (განახლებულია)
    port: 5432,               // PostgreSQL ნაგულისხმევი პორტი
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

// მარშრუტი (Route) მთავარი გვერდისთვის
app.get('/', (req, res) => {
    res.send('მოგესალმებით თქვენს ბიზნეს აპლიკაციის Backend-ზე!');
});

// მაგალითი მარშრუტი: მონაცემების მიღება PostgreSQL-დან
// დავუშვათ, გაქვთ ცხრილი სახელად 'users' თქვენს 'my_business_db' მონაცემთა ბაზაში
app.get('/users', async (req, res) => {
    try {
        // შეკითხვა მონაცემთა ბაზაში ყველა მომხმარებლის მისაღებად
        const result = await pool.query('SELECT * FROM users');
        // გაგზავნეთ მომხმარებლები JSON ფორმატში
        res.json(result.rows);
    } catch (err) {
        // შეცდომის დამუშავება
        console.error('Error executing query', err.stack);
        res.status(500).json({ error: 'მონაცემების მიღების შეცდომა' });
    }
});

// მაგალითი მარშრუტი: ახალი მომხმარებლის დამატება
app.post('/users', async (req, res) => {
    const { name, email } = req.body; // მიიღეთ სახელი და ელფოსტა მოთხოვნის სხეულიდან

    // შეამოწმეთ, არის თუ არა სახელი და ელფოსტა მოცემული
    if (!name || !email) {
        return res.status(400).json({ error: 'სახელი და ელფოსტა სავალდებულოა' });
    }

    try {
        // შეკითხვა მონაცემთა ბაზაში ახალი მომხმარებლის ჩასამატებლად
        const result = await pool.query(
            'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
            [name, email]
        );
        // გაგზავნეთ ახლად შექმნილი მომხმარებელი
        res.status(201).json(result.rows[0]);
    } catch (err) {
        // შეცდომის დამუშავება
        console.error('Error executing insert query', err.stack);
        res.status(500).json({ error: 'მომხმარებლის დამატების შეცდომა' });
    }
});

// სერვერის გაშვება
app.listen(port, () => {
    console.log(`სერვერი გაშვებულია http://localhost:${port}-ზე`);
});


