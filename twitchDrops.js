const { EmbedBuilder } = require('discord.js');
const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');

const parser = new Parser();
const TWITCH_DROPS_CHANNEL_ID = '1565869714746380329';
const DATA_FILE = path.join(__dirname, 'dropsData.json');

// Scans the official Rockstar Newswire RSS feed
const RSS_FEED_URL = 'https://www.rockstargames.com/newswire.rss'; 

async function checkDrops(client) {
    try {
        const feed = await parser.parseURL(RSS_FEED_URL);
        
        // Search the feed for any mention of Twitch Drops combined with GTA
        const dropArticle = feed.items.find(item => 
            (item.title.toLowerCase().includes('twitch') || item.title.toLowerCase().includes('drop')) &&
            (item.title.toLowerCase().includes('gta') || item.title.toLowerCase().includes('grand theft auto'))
        );

        if (!dropArticle) return;

        // Check the local file to see if this article was already posted
        let lastArticle = '';
        if (fs.existsSync(DATA_FILE)) {
            const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            lastArticle = data.lastArticle;
        }

        if (dropArticle.title === lastArticle) {
            return; // Exit silently if already announced
        }

        const channel = await client.channels.fetch(TWITCH_DROPS_CHANNEL_ID);
        if (!channel) return console.error('Twitch Drops channel not found.');

        const dropEmbed = new EmbedBuilder()
            .setColor('#D4AF37')
            .setTitle(`🎮 New GTA Online Twitch Drop: ${dropArticle.title}`)
            .setURL(dropArticle.link)
            .setDescription(dropArticle.contentSnippet || 'A new Grand Theft Auto Online Twitch Drop campaign has been announced. Link your Rockstar Games Social Club account to your Twitch account to claim your rewards.')
            .addFields(
                { name: '🔗 Read More', value: `[Click here for the official Newswire post](${dropArticle.link})`, inline: false }
            )
            .setThumbnail('https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Rockstar_Games_Logo.svg/1024px-Rockstar_Games_Logo.svg.png')
            .setFooter({ text: 'Official Nugzz Bot • Twitch Drops Tracker', iconURL: client.user?.displayAvatarURL() })
            .setTimestamp(new Date(dropArticle.pubDate));

        await channel.send({ content: 'Heads up @everyone, new GTA Online drops are live!', embeds: [dropEmbed] });

        // Save to prevent duplicate posts on future bot restarts
        fs.writeFileSync(DATA_FILE, JSON.stringify({ lastArticle: dropArticle.title }, null, 2));
        console.log('Successfully posted automated Twitch Drop alert.');

    } catch (error) {
        console.error('Error checking for automated Twitch Drops:', error);
    }
}

module.exports = {
    startDropsMonitor: (client) => {
        // Run once immediately on startup
        checkDrops(client);
        // Poll the RSS feed every 60 minutes (3,600,000 milliseconds)
        setInterval(() => checkDrops(client), 3600000);
        console.log('Twitch Drops RSS monitor initialized.');
    }
};