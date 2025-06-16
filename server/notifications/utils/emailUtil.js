/**
 * Email Utility for Stock Notifications
 */
const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config/config');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

class EmailUtil {
    constructor() {
        // Initialize the transporter with email credentials
        this.transporter = nodemailer.createTransport({
            service: config.email.service,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD,
            }
        });

        // Register handlebars helpers
        handlebars.registerHelper('formatPercent', function(num) {
            return (num) ? `${(num * 100).toFixed(2)}%` : 'N/A';
        });

        handlebars.registerHelper('formatLargeNumber', function(num) {
            return new Intl.NumberFormat().format(num);
        });
    }

    /**
     * Load and compile an email template
     * @param {string} templateName - The name of the template file without extension
     * @param {object} data - Data to be injected into the template
     * @returns {Promise<string>} - Compiled HTML
     */
    async compileTemplate(templateName, data) {
        try {
            const templatePath = path.join(__dirname, '../templates', `${templateName}.html`);
            const templateContent = await fs.readFile(templatePath, 'utf-8');
            const template = handlebars.compile(templateContent);
            return template(data);
        } catch (error) {
            console.error(`Error compiling template ${templateName}:`, error);
            throw error;
        }
    }

    /**
     * Send an email
     * @param {string} subject - Email subject
     * @param {string} htmlContent - HTML content of the email
     * @param {array} recipients - List of email recipients
     * @returns {Promise} - Nodemailer send result
     */
    async sendEmail(subject, htmlContent, recipients = config.email.recipients) {
        if (!recipients || recipients.length === 0 || (recipients.length === 1 && !recipients[0])) {
            console.warn('No recipients specified for email notification');
            return;
        }

        try {
            const mailOptions = {
                from: config.email.from,
                to: recipients.join(','),
                subject: config.email.subjectPrefix + subject,
                html: htmlContent
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log(`Email sent: ${result.messageId}`);
            return result;
        } catch (error) {
            console.error('Error sending email:', error);
            throw error;
        }
    }

    /**
     * Send a stock notification email
     * @param {object} notificationData - Data for the notification
     * @returns {Promise} - Email send result
     */
    async sendStockNotification(notificationData) {
        try {
            const html = await this.compileTemplate('stockAlert', notificationData);
            const subject = `Stock Alerts for ${new Date().toLocaleDateString()}`;
            return await this.sendEmail(subject, html);
        } catch (error) {
            console.error('Failed to send stock notification email:', error);
            throw error;
        }
    }
}

module.exports = new EmailUtil(); 