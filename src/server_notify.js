const express = require('express');
const app = express();
app.use(express.json());

const notifications = [];

app.post('/api/notify', (req, res) => {
  const { message, priority = 'normal' } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const notification = {
    id: Date.now(),
    message,
    priority,
    timestamp: new Date().toISOString()
  };

  notifications.push(notification);
  console.log('📨 Received notification:', notification);

  res.json({ success: true, notification });
});

app.get('/api/notifications', (req, res) => {
  res.json(notifications);
});

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Notification server running on http://0.0.0.0:${PORT}`);
});