require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Partials } = require('discord.js');
const { startDropsMonitor } = require('./twitchDrops');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// Your existing Channel & Role IDs
const CHANNELS = {
    trap: '1522621788809330832',
    banLogs: '1391912641529774161',
    chatLogs: '1391913833882321079',
    voiceLogs: '1554560861597868112',
    generalLogs: '1274531597663735899',
    welcome: '1289625226149236829'
};

const ROLES = {
    dumbass: '1348346119092048023',
    under16: '1332829647028617308'
};

const BRAND_COLOR = '#D4AF37';

// Helper Function for Auto-Bans & Unban Button
async function banAndLog(member, guild, reason) {
    try {
        // Ban user and purge posts from the last 6 hours
        await member.ban({ deleteMessageSeconds: 6 * 60 * 60, reason: reason }); 
        
        const banChannel = await guild.channels.fetch(CHANNELS.banLogs);
        if (!banChannel) return;

        const embed = new EmbedBuilder()
            .setColor(BRAND_COLOR)
            .setTitle('🔨 User Banned')
            .addFields(
                { name: 'User', value: `${member.user.tag} (${member.id})` },
                { name: 'Reason', value: reason }
            )
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`unban_${member.id}`)
                    .setLabel('UNBAN')
                    .setStyle(ButtonStyle.Success)
            );

        await banChannel.send({ embeds: [embed], components: [row] });
    } catch (error) {
        console.error(`Failed to ban ${member.user.tag}:`, error);
    }
}

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    // Initializes the new Twitch Drops RSS Monitor
    startDropsMonitor(client); 
});

// Handle the Green Unban Button
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    if (interaction.customId.startsWith('unban_')) {
        const userId = interaction.customId.split('_')[1];
        try {
            await interaction.guild.members.unban(userId);
            
            const embed = EmbedBuilder.from(interaction.message.embeds[0])
                .setTitle('✅ User Unbanned')
                .setColor('#00FF00'); // Changes to green on success

            await interaction.update({ embeds: [embed], components: [] });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Failed to unban user or user is not banned.', ephemeral: true });
        }
    }
});

// Message Create Events: Trap Channel & Anti-Invite Links
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    // Trap Channel Auto-Ban
    if (message.channel.id === CHANNELS.trap) {
        const member = message.member;
        if (member) {
            await banAndLog(member, message.guild, 'Spoke in the bot trap channel.');
        }
        return;
    }

    // Anti-Invite System
    const inviteRegex = /(discord\.gg\/|discord\.com\/invite\/)/i;
    if (inviteRegex.test(message.content)) {
        await message.delete().catch(console.error);
        const genLogChannel = await message.guild.channels.fetch(CHANNELS.generalLogs);
        if (genLogChannel) {
            const embed = new EmbedBuilder()
                .setColor(BRAND_COLOR)
                .setTitle('🔗 Unauthorized Invite Removed')
                .setDescription(`${message.author.tag} posted an invite link in <#${message.channel.id}>.`)
                .setTimestamp();
            await genLogChannel.send({ embeds: [embed] });
        }
    }
});

// Role Update Events: Dumbass & 16 and under Auto-Bans
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
    
    if (addedRoles.has(ROLES.dumbass)) {
        await banAndLog(newMember, newMember.guild, 'Received the "Dumbass" role.');
    } else if (addedRoles.has(ROLES.under16)) {
        await banAndLog(newMember, newMember.guild, 'Received the "16 and under" role.');
    }
});

// Chat Logs: Message Edits
client.on('messageUpdate', async (oldMessage, newMessage) => {
    if (oldMessage.author?.bot || oldMessage.content === newMessage.content) return;
    
    const chatChannel = await newMessage.guild.channels.fetch(CHANNELS.chatLogs).catch(() => null);
    if (!chatChannel) return;

    const embed = new EmbedBuilder()
        .setColor(BRAND_COLOR)
        .setTitle('✏️ Message Edited')
        .addFields(
            { name: 'Author', value: `${newMessage.author.tag}`, inline: true },
            { name: 'Channel', value: `<#${newMessage.channel.id}>`, inline: true },
            { name: 'Old', value: oldMessage.content || 'None' },
            { name: 'New', value: newMessage.content || 'None' }
        )
        .setTimestamp();

    await chatChannel.send({ embeds: [embed] });
});

// Chat Logs: Message Deletes
client.on('messageDelete', async message => {
    if (message.author?.bot) return;

    const chatChannel = await message.guild.channels.fetch(CHANNELS.chatLogs).catch(() => null);
    if (!chatChannel) return;

    const embed = new EmbedBuilder()
        .setColor(BRAND_COLOR)
        .setTitle('🗑️ Message Deleted')
        .addFields(
            { name: 'Author', value: `${message.author.tag}`, inline: true },
            { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
            { name: 'Content', value: message.content || '*Media/Embed*' }
        )
        .setTimestamp();

    await chatChannel.send({ embeds: [embed] });
});

// Voice Logs: Joins, Leaves, Moves
client.on('voiceStateUpdate', async (oldState, newState) => {
    const voiceChannel = await newState.guild.channels.fetch(CHANNELS.voiceLogs).catch(() => null);
    if (!voiceChannel) return;

    const member = newState.member;
    const embed = new EmbedBuilder().setColor(BRAND_COLOR).setTimestamp();

    if (!oldState.channelId && newState.channelId) {
        embed.setTitle('🎙️ Joined Voice').setDescription(`${member.user.tag} joined <#${newState.channelId}>`);
        await voiceChannel.send({ embeds: [embed] });
    } else if (oldState.channelId && !newState.channelId) {
        embed.setTitle('🎙️ Left Voice').setDescription(`${member.user.tag} left <#${oldState.channelId}>`);
        await voiceChannel.send({ embeds: [embed] });
    } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        embed.setTitle('🎙️ Moved Voice').setDescription(`${member.user.tag} moved from <#${oldState.channelId}> to <#${newState.channelId}>`);
        await voiceChannel.send({ embeds: [embed] });
    }
});

// Welcome Logs
client.on('guildMemberAdd', async member => {
    const welcomeChannel = await member.guild.channels.fetch(CHANNELS.welcome).catch(() => null);
    if (!welcomeChannel) return;

    const embed = new EmbedBuilder()
        .setColor(BRAND_COLOR)
        .setTitle('👋 Welcome!')
        .setDescription(`Welcome to the server, ${member.user.tag}!`)
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp();

    await welcomeChannel.send({ embeds: [embed] });
});

client.login(process.env.DISCORD_TOKEN);