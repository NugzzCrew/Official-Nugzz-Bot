const { EmbedBuilder } = require('discord.js');
const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');

// Custom headers to prevent the bot from being blocked by web firewalls
const parser = new Parser({
    headers: {
        'User-Agent': 'OfficialNugzzBot/1.0 (Discord Bot Tracking Twitch Drops)'
    }
});

const TWITCH_DROPS_CHANNEL_ID = '1565869714746380329';
const DATA_FILE = path.join(__dirname, 'dropsData.json');

// Using the GTA Online community RSS as a reliable fallback tracker
const RSS_FEED_URL = 'https://www.reddit.com/r/gtaonline/search.rss?q=title%3A%22twitch+drops%22+OR+title%3A%22drop%22&restrict_sr=on&sort=new&t=month'; 

async function checkDrops(client) {
    try {
        const feed = await parser.parseURL(RSS_FEED_URL);
        
        // Search the feed for Twitch Drops related to GTA
        const dropArticle = feed.items.find(item => 
            (item.title.toLowerCase().includes('twitch') || item.title.toLowerCase().includes('drop'))
        );

        if (!dropArticle) return;

        // Prevent duplicate posts on server restarts
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
            .setTitle(`🎮 GTA Online Twitch Drop Detected: ${dropArticle.title}`)
            .setURL(dropArticle.link)
            .setDescription('A new Grand Theft Auto Online Twitch Drop campaign announcement has been detected. Link your Rockstar Games Social Club account to your Twitch account to claim your rewards.')
            .addFields(
                { name: '🔗 Read More', value: `[Click here for details](${dropArticle.link})`, inline: false }
            )
            .setThumbnail('https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Rockstar_Games_Logo.svg/1024px-Rockstar_Games_Logo.svg.png')
            .setFooter({ text: 'Official Nugzz Bot • Twitch Drops Tracker', iconURL: client.user?.displayAvatarURL() })
            .setTimestamp(new Date(dropArticle.pubDate || Date.now()));

        await channel.send({ content: 'Heads up @everyone, new GTA Online drops might be live!', embeds: [dropEmbed] });

        // Save the latest article title locally
        fs.writeFileSync(DATA_FILE, JSON.stringify({ lastArticle: dropArticle.title }, null, 2));
        console.log('Successfully posted automated Twitch Drop alert.');

    } catch (error) {
        // Keeps the bot running even if the feed temporarily goes down
        console.error('Error checking for automated Twitch Drops:', error.message);
    }
}

module.exports = {
    startDropsMonitor: (client) => {
        checkDrops(client);
        setInterval(() => checkDrops(client), 3600000); // Checks every 60 minutes
        console.log('Twitch Drops RSS monitor initialized with updated data source.');
    }
};