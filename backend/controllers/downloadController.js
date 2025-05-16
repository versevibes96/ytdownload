const YoutubeService = require('../services/youtubeService');
const { getFilePath } = require('../utils/storage');
const fs = require('fs-extra');
const path = require('path');

const downloadMedia = async (req, res) => {
  try {
    const { url, format, quality } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    // Validate URL format
    if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    let result;
    try {
      if (format === 'mp3') {
        result = await YoutubeService.downloadAudio(url);
      } else {
        result = await YoutubeService.downloadVideo(url, quality || '720');
      }
    } catch (downloadError) {
      console.error('Download process error:', downloadError);
      return res.status(500).json({ 
        error: 'Failed to process download',
        details: downloadError.message 
      });
    }

    // Check if file exists before sending
    if (!await fs.pathExists(result.filePath)) {
      return res.status(500).json({ error: 'Downloaded file not found' });
    }

    // Set appropriate headers
    res.setHeader('Content-Type', format === 'mp3' ? 'audio/mpeg' : 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);

    // Stream the file to the client
    const fileStream = fs.createReadStream(result.filePath);
    fileStream.pipe(res);

    // Handle stream errors
    fileStream.on('error', (error) => {
      console.error('Stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error streaming file' });
      }
    });

    // Clean up file after sending
    fileStream.on('end', () => {
      fs.unlink(result.filePath).catch(err => {
        console.error('Error deleting file:', err);
      });
    });

  } catch (error) {
    console.error('Controller error:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Download failed',
        details: error.message 
      });
    }
  }
};

module.exports = {
  downloadMedia,
};
