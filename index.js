const express = require('express');
const app = express();
const PORT = 3001;
const nodemailer = require('nodemailer');
const { Storage } = require('@google-cloud/storage');
const axios = require('axios');
require('dotenv').config();

const outputLinks = [];
let storedEmail = null; // Store the email globally

app.use(express.json());

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'sarthak1509@gmail.com',
        pass: 'xqpw cgia jwey twge',
    },
});

const bucketName = 'avataryaidemo_bucket';
const storage = new Storage({
    projectId: process.env.GOOGLE_PROJECT_ID,
    credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
});

app.post('/email', (req, res) => {
    const { email } = req.body;
    storedEmail = email; // Store the email
    console.log(storedEmail);
    res.status(200).send('Email received successfully');
});

app.post('/webhook_predictions', (req, res) => {
    const payload = req.body;

    if (payload && Array.isArray(payload.output) && payload.output.length > 0) {
        const outputLink = payload.output[0];
        outputLinks.push(outputLink);

        if (outputLinks.length === 18) {
            console.log('Output Links:', outputLinks);
            processOutputLinks(); // Call function to process output links
        }
    } else {
        console.error('Invalid payload format or missing output link.');
    }

    res.status(200).send('Webhook received successfully');
});

async function processOutputLinks() {
    try {
        const publicUrls = await uploadToGoogleCloudStorage(outputLinks);
        await sendEmail(storedEmail, publicUrls); // Send email with public URLs
    } catch (error) {
        console.error('Error processing output links:', error);
    }
}

async function uploadToGoogleCloudStorage(links) {
    const publicUrls = [];

    for (let i = 0; i < links.length; i++) {
        const link = links[i];
        const imageFilename = `image_${i}.jpg`;

        try {
            const response = await axios.get(link, { responseType: 'stream' });

            const bucket = storage.bucket(bucketName);
            const file = bucket.file(imageFilename);

            const stream = file.createWriteStream({
                metadata: {
                    contentType: 'image/jpeg',
                },
            });

            response.data.pipe(stream);

            await new Promise((resolve, reject) => {
                stream.on('finish', resolve);
                stream.on('error', (err) => {
                    console.error(`Error uploading image ${i}:`, err);
                    reject(err);
                });
            });

            const publicUrl = `https://storage.googleapis.com/${bucketName}/${imageFilename}`;
            publicUrls.push(publicUrl);
        } catch (error) {
            console.error(`Error uploading image ${i}:`, error);
        }
    }

    return publicUrls;
}

async function sendEmail(email, publicUrls) {
    if (!email) {
        console.error('No email provided to send the AI hairstyle styles.');
        return;
    }

    const imagesHtml = publicUrls
        .map((link) => {
            return `
        <div style="display: flex; justify-content: center;">
          <img src="${link}" alt="Image" style="width: 300px; height: auto; margin: 10px;">
        </div>
      `;
        })
        .join('');

    const html = `
    <html>
      <body>
        <h1>Hover over the images to download. Please download within 24 hrs of getting this email</h1>
        ${imagesHtml}
      </body>
    </html>
  `;

    const info = await transporter.sendMail({
        from: '"AI Haircuts" <sarthak1509@gmail.com>',
        to: email, // Use the provided email
        subject: 'Your AI hairstyles styles are here!',
        html: html,
    });

    console.log('Message sent: %s', info.messageId);
}

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
