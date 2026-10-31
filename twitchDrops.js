const { EmbedBuilder } = require('discord.js');
const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');

const parser = new Parser({
    headers: {
        'User-Agent': 'OfficialNugzzBot/1.0 (Discord Bot Tracking Twitch Drops)'
    }
});

const TWITCH_DROPS_CHANNEL_ID = '1565869714746380329';
const DATA_FILE = path.join(__dirname, 'dropsData.json');

// Broadened to search r/gtaonline, r/NoPixel, and r/GrandTheftAutoV for any mention of drops
const RSS_FEED_URL = 'https://www.reddit.com/r/gtaonline+NoPixel+GrandTheftAutoV/search.rss?q=title%3A%22twitch+drops%22+OR+title%3A%22drop%22&restrict_sr=on&sort=new&t=month'; 

async function checkDrops(client) {
    try {
        const feed = await parser.parseURL(RSS_FEED_URL);
        
        const dropArticle = feed.items.find(item => 
            (item.title.toLowerCase().includes('twitch') || item.title.toLowerCase().includes('drop'))
        );

        if (!dropArticle) return;

        let lastArticle = '';
        if (fs.existsSync(DATA_FILE)) {
            const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            lastArticle = data.lastArticle;
        }

        if (dropArticle.title === lastArticle) {
            return; 
        }

        const channel = await client.channels.fetch(TWITCH_DROPS_CHANNEL_ID);
        if (!channel) return console.error('Twitch Drops channel not found.');

        const dropEmbed = new EmbedBuilder()
            .setColor('#D4AF37')
            .setTitle(`🎮 GTA Twitch Drop Detected: ${dropArticle.title}`)
            .setURL(dropArticle.link)
            .setDescription('A new Grand Theft Auto Twitch Drop campaign has been detected! Check your Twitch inventory and ensure your accounts are linked to claim your rewards.')
            .addFields(
                { name: '🔗 Source / Read More', value: `[Click here for details](${dropArticle.link})`, inline: false }
            )
            .setThumbnail('https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Rockstar_Games_Logo.svg/1024px-Rockstar_Games_Logo.svg.png')
            .setFooter({ text: 'Official Nugzz Bot • Twitch Drops Tracker', iconURL: client.user?.displayAvatarURL() })
            .setTimestamp(new Date(dropArticle.pubDate || Date.now()));

        await channel.send({ content: 'Heads up @everyone, a new GTA Twitch Drop was just announced!', embeds: [dropEmbed] });

        fs.writeFileSync(DATA_FILE, JSON.stringify({ lastArticle: dropArticle.title }, null, 2));
        console.log('Successfully posted automated Twitch Drop alert.');

    } catch (error) {
        console.error('Error checking for automated Twitch Drops:', error.message);
    }
}

module.exports = {
    startDropsMonitor: (client) => {
        checkDrops(client);
        setInterval(() => checkDrops(client), 3600000); 
        console.log('Twitch Drops RSS monitor initialized with expanded NoPixel support.');
    }
};