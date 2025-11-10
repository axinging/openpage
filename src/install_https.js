const https = require('https');
const http = require('http');
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');
const { HttpsProxyAgent } = require('https-proxy-agent');

async function setupMkcert() {
    console.log('Starting mkcert setup...');

    try {
        // Step 1: Download mkcert
        console.log('1. Downloading mkcert...');
        const mkcertUrl = 'https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-windows-amd64.exe';
        const originalName = 'mkcert-v1.4.4-windows-amd64.exe';
        const newName = 'mkcert.exe';

        await downloadFileWithRetry(mkcertUrl, originalName);
        
        // Rename file
        if (fs.existsSync(originalName)) {
            if (fs.existsSync(newName)) {
                fs.unlinkSync(newName);
            }
            fs.renameSync(originalName, newName);
            console.log(`Renamed ${originalName} -> ${newName}`);
        }

        // Step 2: Run mkcert command
        console.log('2. Running mkcert command...');
        
        // Install CA
        console.log('Installing CA...');
        execSync(`"${newName}" -install`, { stdio: 'inherit' });
        
        // Generate certificate
        console.log('Generating local certificate...');
        execSync(`"${newName}" 0.0.0.0 localhost 127.0.0.1 ::1`, { stdio: 'inherit' });

        // Step 3: Rename pem files
        console.log('3. Renaming certificate files...');
        
        const keyFile = '0.0.0.0+3-key.pem';
        const certFile = '0.0.0.0+3.pem';
        const newKeyFile = 'key.pem';
        const newCertFile = 'cert.pem';

        // Check if files exist and rename
        if (fs.existsSync(keyFile) && fs.existsSync(certFile)) {
            // If target files exist, delete first
            if (fs.existsSync(newKeyFile)) fs.unlinkSync(newKeyFile);
            if (fs.existsSync(newCertFile)) fs.unlinkSync(newCertFile);
            
            fs.renameSync(keyFile, newKeyFile);
            fs.renameSync(certFile, newCertFile);
            
            console.log(`Renamed ${keyFile} -> ${newKeyFile}`);
            console.log(`Renamed ${certFile} -> ${newCertFile}`);
        } else {
            // If default file names do not exist, try to find other possible file names
            renamePemFiles();
        }

        console.log('✅ mkcert setup complete!');
        console.log('Generated certificate files:');
        console.log('  - key.pem (private key)');
        console.log('  - cert.pem (certificate)');
        console.log('npx http-server -S -C ./cert.pem');

    } catch (error) {
        console.error('❌ Error occurred during setup:', error.message);
        process.exit(1);
    }
}

function downloadFileWithRetry(fileUrl, outputPath, retries = 3) {
    return new Promise((resolve, reject) => {
        const attemptDownload = (attempt) => {
            downloadFile(fileUrl, outputPath)
                .then(resolve)
                .catch((error) => {
                    if (attempt < retries) {
                        console.log(`Download failed, retrying attempt ${attempt + 1}...`);
                        setTimeout(() => attemptDownload(attempt + 1), 1000);
                    } else {
                        reject(error);
                    }
                });
        };
        
        attemptDownload(1);
    });
}

function downloadFile(fileUrl, outputPath) {
    return new Promise((resolve, reject) => {
        console.log(`Downloading: ${fileUrl}`);
        
        // Proxy config - supports environment variables
        const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy;
        
        const options = {
            method: 'GET'
        };
        
        // Use https-proxy-agent if proxy is set
        if (proxyUrl) {
            console.log(`Using proxy: ${proxyUrl}`);
            options.agent = new HttpsProxyAgent(proxyUrl);
        }
        
        const req = https.get(fileUrl, options, (response) => {
            // Handle redirect
            if (response.statusCode === 302 || response.statusCode === 301) {
                const redirectUrl = response.headers.location;
                console.log(`Redirecting to: ${redirectUrl}`);
                downloadFile(redirectUrl, outputPath).then(resolve).catch(reject);
                return;
            } else if (response.statusCode !== 200) {
                reject(new Error(`Download failed, status code: ${response.statusCode}`));
                return;
            }

            const file = fs.createWriteStream(outputPath);
            const totalSize = parseInt(response.headers['content-length'], 10);
            let downloadedSize = 0;
            
            response.on('data', (chunk) => {
                downloadedSize += chunk.length;
                if (totalSize) {
                    const percent = ((downloadedSize / totalSize) * 100).toFixed(1);
                    process.stdout.write(`\rDownload progress: ${percent}% (${downloadedSize}/${totalSize} bytes)`);
                }
            });

            response.pipe(file);

            file.on('finish', () => {
                file.close();
                console.log('\nDownload complete:', outputPath);
                resolve();
            });
            
            file.on('error', (err) => {
                fs.unlink(outputPath, () => {});
                reject(new Error(`File write error: ${err.message}`));
            });
        });

        req.on('error', (err) => {
            reject(new Error(`Download error: ${err.message}`));
        });
        
        // Set timeout
        req.setTimeout(30000, () => {
            req.destroy();
            reject(new Error('Download timed out'));
        });

        req.end();
    });
}

function renamePemFiles() {
    console.log('Searching for certificate files...');
    
    // Find all .pem files in current directory
    const files = fs.readdirSync('.');
    const pemFiles = files.filter(file => file.endsWith('.pem'));
    
    let keyFile = null;
    let certFile = null;
    
    // Find files by naming pattern
    for (const file of pemFiles) {
        if (file.includes('-key.pem')) {
            keyFile = file;
        } else if (file.includes('.pem') && !file.includes('-key.pem')) {
            certFile = file;
        }
    }
    
    if (keyFile && certFile) {
        const newKeyFile = 'key.pem';
        const newCertFile = 'cert.pem';
        
        // If target files exist, delete first
        if (fs.existsSync(newKeyFile)) fs.unlinkSync(newKeyFile);
        if (fs.existsSync(newCertFile)) fs.unlinkSync(newCertFile);
        
        fs.renameSync(keyFile, newKeyFile);
        fs.renameSync(certFile, newCertFile);
        
        console.log(`Renamed ${keyFile} -> ${newKeyFile}`);
        console.log(`Renamed ${certFile} -> ${newCertFile}`);
    } else {
        console.log('⚠️  Certificate files not found, please rename manually:');
        console.log('   Private key file: *-key.pem -> key.pem');
        console.log('   Certificate file: *.pem -> cert.pem');
    }
}

// Check current platform
if (process.platform !== 'win32') {
    console.log('⚠️  This script is mainly designed for Windows');
    console.log('For other platforms, please download mkcert from:');
    console.log('https://github.com/FiloSottile/mkcert/releases');
}

// Run setup
setupMkcert();