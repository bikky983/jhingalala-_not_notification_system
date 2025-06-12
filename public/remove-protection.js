/**
 * Remove Protection Script
 * Removes site-protection.js references from all HTML files
 * 
 * Usage: node remove-protection.js
 */

const fs = require('fs');
const path = require('path');

// Process all HTML files in the current directory
function removeProtectionFromHtmlFiles() {
    console.log('Looking for HTML files to remove protection from...');
    
    const files = fs.readdirSync('.');
    const htmlFiles = files.filter(file => file.endsWith('.html'));
    
    console.log(`Found ${htmlFiles.length} HTML files`);
    
    let updatedCount = 0;
    
    htmlFiles.forEach(file => {
        let content = fs.readFileSync(file, 'utf8');
        let originalContent = content;
        
        // Remove site-protection.js script tags with various formats
        content = content.replace(/<!-- Protection script -->\s*<script src="site-protection\.js"><\/script>\s*/g, '');
        content = content.replace(/<script src="site-protection\.js"><\/script>\s*/g, '');
        
        // Check if content was modified
        if (content !== originalContent) {
            fs.writeFileSync(file, content, 'utf8');
            console.log(`✅ Removed protection from: ${file}`);
            updatedCount++;
        } else {
            console.log(`✓ No protection found in: ${file}`);
        }
    });
    
    console.log(`\nProtection removal complete! Updated ${updatedCount} files.`);
}

// Run the cleanup
removeProtectionFromHtmlFiles(); 