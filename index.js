require('dotenv').config();
const { 
  Client, 
  GatewayIntentBits, 
  Events, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  EmbedBuilder,
  PermissionsBitField,
  ChannelType,
  PermissionFlagsBits
} = require('discord.js');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences 
  ]
});

// Server & Role IDs
const GUILD_ID = '999413076505936023';
const DUMBASS_ROLE_ID = '1348346119092048023';
const UNDERAGE_ROLE_ID = '1332829647028617308';
const TRAP_CHANNEL_ID = '1522621788809330832';

// Log Channel IDs
const CHAT_LOG_CHANNEL_ID = '1391913833882321079';
const VOICE_LOG_CHANNEL_ID = '1554560861597868112';
const BAN_LOG_CHANNEL_ID = '1391912641529774161';
const GENERAL_LOG_CHANNEL_ID = '1274531597663735899';
const WELCOME_CHANNEL_ID = '1289625226149236829';

// Twitch Drops Channel
const TWITCH_DROPS_CHANNEL_ID = '1565869714746380329';

// ========== DMO TICKET SYSTEM ==========
const DMO_CATEGORY_ID = '1289277729098698793';
const DMO_PANEL_CHANNEL_ID = '1277822812534607882';
const OWNER_ROLE_ID = '1278446192404992021';
const DMO_PRO_ROLE_ID = '1274519327374053386';
// ========================================

// Regex pattern matching all Discord invite formats
const DISCORD_INVITE_REGEX = /(https?:\/\/)?(www\.)?(discord\.(gg|io|me|li)|discord(app)?\.com\/invite)\/[a-zA-Z0-9\-]+/i;

const LAST_DROP_FILE = path.join(__dirname, 'lastTwitchDrop.json');

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}!`);
  console.log('Bot is online and ready.');

  // Daily Twitch Drops check at 12:00 UTC (4 AM PST / 5 AM PDT)
  cron.schedule('0 12 * * *', () => {
    console.log('Running daily Twitch Drops check...');
    checkTwitchDrops();
  }, {
    timezone: 'UTC'
  });

  // Optional: also run once on startup (comment out if you don't want this)
  // setTimeout(() => checkTwitchDrops(), 10000);
});

// ==========================================
// TWITCH DROPS CHECKER (free Sunkwi API)
// ==========================================
async function checkTwitchDrops(force = false) {
  try {
    const res = await fetch('https://twitch-drops-api.sunkwi.com/v2/drops');
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    const json = await res.json();

    const gtaCampaigns = (json.data || []).filter(c =>
      /gta|grand theft auto/i.test(c.gameDisplayName || '')
    );

    if (gtaCampaigns.length === 0) {
      console.log('No active GTA Twitch Drops found.');
      return;
    }

    // Use the first / primary GTA campaign
    const campaign = gtaCampaigns[0];
    const uniqueKey = `${campaign.gameId}-${campaign.endAt}`;

    // Load last posted
    let last = null;
    if (fs.existsSync(LAST_DROP_FILE)) {
      try {
        last = JSON.parse(fs.readFileSync(LAST_DROP_FILE, 'utf8'));
      } catch {}
    }

    if (!force && last && last.uniqueKey === uniqueKey) {
      console.log('Same GTA drop already posted. Skipping.');
      return;
    }

    // Build embed
    const rewardText = campaign.rewards?.[0]?.description || 
                       campaign.rewards?.[0]?.name || 
                       'See Rockstar page for details';

    const endUnix = Math.floor(new Date(campaign.endAt).getTime() / 1000);

    const embed = new EmbedBuilder()
      .setColor('#FFD700') // Nugzz gold
      .setTitle('🎁 New GTA Online Twitch Drop Active')
      .setDescription(rewardText)
      .addFields(
        { name: 'Game', value: campaign.gameDisplayName || 'Grand Theft Auto V', inline: true },
        { name: 'Ends', value: `<t:${endUnix}:F> (<t:${endUnix}:R>)`, inline: true },
        { name: 'How to Claim', value: '[Rockstar Twitch Drops Page](https://www.rockstargames.com/gta-online/twitch-drops)\nWatch participating streams with **Drops Enabled**.' }
      )
      .setFooter({ text: 'Official Nugzz Crew • Fam Bam' })
      .setTimestamp();

    if (campaign.gameBoxArtURL) {
      embed.setThumbnail(campaign.gameBoxArtURL);
    }

    const channel = client.channels.cache.get(TWITCH_DROPS_CHANNEL_ID);
    if (!channel) {
      console.error('Twitch Drops channel not found:', TWITCH_DROPS_CHANNEL_ID);
      return;
    }

    await channel.send({ embeds: [embed] });
    console.log('Posted new GTA Twitch Drop embed.');

    // Save so we don't post again
    fs.writeFileSync(LAST_DROP_FILE, JSON.stringify({
      uniqueKey,
      gameId: campaign.gameId,
      endAt: campaign.endAt,
      postedAt: new Date().toISOString()
    }, null, 2));

  } catch (err) {
    console.error('Twitch Drops check failed:', err.message);
  }
}

// ==========================================
// 1. WELCOME CHANNEL: MEMBER JOIN
// ==========================================
client.on(Events.GuildMemberAdd, async (member) => {
  if (member.guild.id !== GUILD_ID) return;

  const welcomeChannel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
  if (!welcomeChannel) return;

  const createdUnix = Math.floor(member.user.createdTimestamp / 1000);
  const accountAgeMs = Date.now() - member.user.createdTimestamp;
  const isNewAccount = accountAgeMs < 7 * 24 * 60 * 60 * 1000; 

  let description = `**Member joined**\n**${member.user.username}** ${member.guild.memberCount}th to join\n`;
  
  if (isNewAccount) {
    description += `NEW ACCOUNT created <t:${createdUnix}:R>`;
  } else {
    description += `created <t:${createdUnix}:R>`;
  }

  const joinEmbed = new EmbedBuilder()
    .setColor('#57F287') 
    .setAuthor({ 
      name: member.user.username, 
      iconURL: member.user.displayAvatarURL(),
      url: `https://discord.com/users/${member.id}`
    })
    .setDescription(description)
    .setFooter({ text: `ID: ${member.id}` })
    .setTimestamp();

  await welcomeChannel.send({ embeds: [joinEmbed] });
});

// ==========================================
// 2. GENERAL LOGS: MEMBER LEAVE
// ==========================================
client.on(Events.GuildMemberRemove, async (member) => {
  if (member.guild.id !== GUILD_ID) return;

  const generalLogChannel = member.guild.channels.cache.get(GENERAL_LOG_CHANNEL_ID);
  if (!generalLogChannel) return;

  const joinedUnix = member.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : null;
  const joinedText = joinedUnix ? `joined <t:${joinedUnix}:R>` : 'joined at an unknown time';

  let rolesText = '';
  if (member.roles.cache.size > 1) {
    const roles = member.roles.cache.filter(r => r.id !== member.guild.id).map(r => `<@&${r.id}>`).join(' ');
    rolesText = `\n**Roles:** ${roles.length > 1000 ? roles.substring(0, 1000) + '...' : roles}`;
  }

  const leaveEmbed = new EmbedBuilder()
    .setColor('#FEE75C') 
    .setAuthor({ 
      name: member.user.username, 
      iconURL: member.user.displayAvatarURL(),
      url: `https://discord.com/users/${member.id}`
    })
    .setDescription(`**Member left**\n**${member.user.username}** ${joinedText}${rolesText}`)
    .setFooter({ text: `ID: ${member.id}` })
    .setTimestamp();

  await generalLogChannel.send({ embeds: [leaveEmbed] });
});

// ==========================================
// 3. GENERAL LOGS: NICKNAME CHANGES + ROLE AUTO-BANS
// ==========================================
client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  if (newMember.guild.id !== GUILD_ID) return;

  // Auto-ban if they get the Dumbass or Underage role
  if (!oldMember.roles.cache.has(DUMBASS_ROLE_ID) && newMember.roles.cache.has(DUMBASS_ROLE_ID)) {
    await executeBan(newMember.guild, newMember.user, 'Not following socials');
    return;
  }
  if (!oldMember.roles.cache.has(UNDERAGE_ROLE_ID) && newMember.roles.cache.has(UNDERAGE_ROLE_ID)) {
    await executeBan(newMember.guild, newMember.user, 'Underage (16 and under)');
    return;
  }

  // Nickname change logging
  if (oldMember.nickname !== newMember.nickname) {
    const generalLogChannel = newMember.guild.channels.cache.get(GENERAL_LOG_CHANNEL_ID);
    if (!generalLogChannel) return;

    const nickEmbed = new EmbedBuilder()
      .setColor('#00A8FC')
      .setAuthor({ 
        name: newMember.user.username, 
        iconURL: newMember.user.displayAvatarURL(),
        url: `https://discord.com/users/${newMember.id}`
      })
      .setDescription(
        `**Nickname changed**\n**${newMember.user.username}**\n\n` +
        `**Before:** ${oldMember.nickname || '(none)'}\n` +
        `**After:** ${newMember.nickname || '(none)'}`
      )
      .setFooter({ text: `ID: ${newMember.id}` })
      .setTimestamp();

    await generalLogChannel.send({ embeds: [nickEmbed] });
  }
});

// ==========================================
// 4. GENERAL LOGS: USERNAME / AVATAR CHANGES
// ==========================================
client.on(Events.UserUpdate, async (oldUser, newUser) => {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;

  const generalLogChannel = guild.channels.cache.get(GENERAL_LOG_CHANNEL_ID);
  if (!generalLogChannel) return;

  // Username change
  if (oldUser.username !== newUser.username) {
    const usernameEmbed = new EmbedBuilder()
      .setColor('#00A8FC')
      .setAuthor({ 
        name: newUser.username, 
        iconURL: newUser.displayAvatarURL(),
        url: `https://discord.com/users/${newUser.id}`
      })
      .setDescription(
        `**Username changed**\n\n` +
        `**Before:** ${oldUser.username}\n` +
        `**After:** ${newUser.username}`
      )
      .setFooter({ text: `ID: ${newUser.id}` })
      .setTimestamp();

    await generalLogChannel.send({ embeds: [usernameEmbed] });
  }

  // Avatar change
  if (oldUser.avatar !== newUser.avatar) {
    const avatarEmbed = new EmbedBuilder()
      .setColor('#00A8FC')
      .setAuthor({ 
        name: newUser.username, 
        iconURL: newUser.displayAvatarURL(),
        url: `https://discord.com/users/${newUser.id}`
      })
      .setDescription(`**Avatar updated**\n**${newUser.username}** updated their profile picture.`)
      .setThumbnail(newUser.displayAvatarURL({ size: 512 }))
      .setFooter({ text: `ID: ${newUser.id}` })
      .setTimestamp();

    await generalLogChannel.send({ embeds: [avatarEmbed] });
  }
});

// ==========================================
// 5. CHAT LOGS: MESSAGE DELETE
// ==========================================
client.on(Events.MessageDelete, async (message) => {
  if (!message.guild || message.guild.id !== GUILD_ID) return;
  if (message.author?.bot) return;

  const chatLogChannel = message.guild.channels.cache.get(CHAT_LOG_CHANNEL_ID);
  if (!chatLogChannel) return;

  const deleteEmbed = new EmbedBuilder()
    .setColor('#ED4245')
    .setAuthor({ 
      name: message.author?.username || 'Unknown', 
      iconURL: message.author?.displayAvatarURL(),
      url: message.author ? `https://discord.com/users/${message.author.id}` : undefined
    })
    .setDescription(
      `**Message deleted in <#${message.channel.id}>**\n\n` +
      `${message.content || '*No text content*'}\n\n` +
      `**Message ID:** ${message.id}`
    )
    .setFooter({ text: `ID: ${message.author?.id || 'Unknown'}` })
    .setTimestamp();

  await chatLogChannel.send({ embeds: [deleteEmbed] });
});

// ==========================================
// 6. CHAT LOGS: MESSAGE EDIT
// ==========================================
client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
  if (!newMessage.guild || newMessage.guild.id !== GUILD_ID) return;
  if (newMessage.author?.bot) return;
  if (oldMessage.content === newMessage.content) return;

  const chatLogChannel = newMessage.guild.channels.cache.get(CHAT_LOG_CHANNEL_ID);
  if (!chatLogChannel) return;

  const editEmbed = new EmbedBuilder()
    .setColor('#00A8FC')
    .setAuthor({ 
      name: newMessage.author?.username || 'Unknown', 
      iconURL: newMessage.author?.displayAvatarURL(),
      url: newMessage.author ? `https://discord.com/users/${newMessage.author.id}` : undefined
    })
    .setDescription(
      `**Message edited in <#${newMessage.channel.id}>** [Jump to Message](${newMessage.url})\n\n` +
      `**Before:** ${oldMessage.content || '*No text content*'}\n` +
      `**After:** ${newMessage.content || '*No text content*'}\n\n` +
      `**Message ID:** ${newMessage.id}`
    )
    .setFooter({ text: `ID: ${newMessage.author?.id || 'Unknown'}` })
    .setTimestamp();

  await chatLogChannel.send({ embeds: [editEmbed] });
});

// ==========================================
// 7. VOICE LOGS
// ==========================================
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  if (newState.guild.id !== GUILD_ID) return;

  const voiceLogChannel = newState.guild.channels.cache.get(VOICE_LOG_CHANNEL_ID);
  if (!voiceLogChannel) return;

  const member = newState.member || oldState.member;
  if (!member || member.user.bot) return;

  let description = '';
  if (!oldState.channel && newState.channel) {
    description = `**Joined voice channel** <#${newState.channel.id}>`;
  } else if (oldState.channel && !newState.channel) {
    description = `**Left voice channel** <#${oldState.channel.id}>`;
  } else if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
    description = `**Moved voice channels**\n**From:** <#${oldState.channel.id}>\n**To:** <#${newState.channel.id}>`;
  } else {
    return;
  }

  const voiceEmbed = new EmbedBuilder()
    .setColor('#57F287')
    .setAuthor({ 
      name: member.user.username, 
      iconURL: member.user.displayAvatarURL(),
      url: `https://discord.com/users/${member.id}`
    })
    .setDescription(description)
    .setFooter({ text: `ID: ${member.id}` })
    .setTimestamp();

  await voiceLogChannel.send({ embeds: [voiceEmbed] });
});

// ==========================================
// 8. MESSAGE CREATE (commands + honeypot + invite ban + DMO panel)
// ==========================================
client.on(Events.MessageCreate, async (message) => {
  if (!message.guild || message.guild.id !== GUILD_ID) return;
  if (message.author.bot) return;

  // --- DMO PANEL COMMAND ---
  if (message.content === '!dmopanel') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply({ content: 'You do not have permission to run this command.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('DMO Generator')
      .setDescription('Create your DMO specs on the website:\n\n**[OfficialNugzzCrew.com](https://officialnugzzcrew.com/generator)**')
      .setImage('https://i.imgur.com/ffITXg8.png')
      .setColor('#D4AF37')
      .setFooter({ text: 'Official Nugzz Crew • Fam Bam' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('open_dmo_ticket')
        .setLabel('OPEN Ticket')
        .setStyle(ButtonStyle.Success)
    );

    await message.channel.send({ embeds: [embed], components: [row] });
    await message.reply({ content: 'DMO panel posted!', ephemeral: true });
    return;
  }

  // --- MANUAL TEST COMMAND ---
  if (message.content === '!testlogs') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply({ content: 'You do not have permission to run this command.', ephemeral: true });
    }

    try {
      const createdUnix = Math.floor(message.author.createdTimestamp / 1000);
      const joinedUnix = message.member.joinedTimestamp ? Math.floor(message.member.joinedTimestamp / 1000) : null;
      const joinedText = joinedUnix ? `joined <t:${joinedUnix}:R>` : 'joined at an unknown time';
      
      let testRolesText = '';
      if (message.member.roles.cache.size > 1) {
        const roles = message.member.roles.cache.filter(r => r.id !== message.guild.id).map(r => `<@&${r.id}>`).join(' ');
        testRolesText = `\n**Roles:** ${roles}`;
      }

      // Dummy Welcome
      const welcomeChannel = message.guild.channels.cache.get(WELCOME_CHANNEL_ID);
      const joinEmbed = new EmbedBuilder()
        .setColor('#57F287')
        .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL(), url: `https://discord.com/users/${message.author.id}` })
        .setDescription(`**Member joined**\n**${message.author.username}** ${message.guild.memberCount}th to join\n⚠️ **NEW ACCOUNT** created <t:${createdUnix}:R> ⚠️`)
        .setFooter({ text: `ID: ${message.author.id}` }).setTimestamp();
      if (welcomeChannel) await welcomeChannel.send({ embeds: [joinEmbed] });

      // Dummy Leave & Profile Updates
      const generalLogChannel = message.guild.channels.cache.get(GENERAL_LOG_CHANNEL_ID);
      const leaveEmbed = new EmbedBuilder()
        .setColor('#FEE75C')
        .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL(), url: `https://discord.com/users/${message.author.id}` })
        .setDescription(`**Member left**\n**${message.author.username}** ${joinedText}${testRolesText}`)
        .setFooter({ text: `ID: ${message.author.id}` }).setTimestamp();
      
      const nickTestEmbed = new EmbedBuilder()
        .setColor('#00A8FC')
        .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL(), url: `https://discord.com/users/${message.author.id}` })
        .setDescription(`**Nickname changed**\n**${message.author.username}**\n\n**Before:** OldNickTest\n**After:** NewNickTest`)
        .setFooter({ text: `ID: ${message.author.id}` }).setTimestamp();

      const avatarTestEmbed = new EmbedBuilder()
        .setColor('#00A8FC')
        .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL(), url: `https://discord.com/users/${message.author.id}` })
        .setDescription(`**Avatar updated**\n**${message.author.username}** updated their profile picture.`)
        .setThumbnail(message.author.displayAvatarURL({ size: 512 }))
        .setFooter({ text: `ID: ${message.author.id}` }).setTimestamp();

      if (generalLogChannel) {
        await generalLogChannel.send({ embeds: [leaveEmbed, nickTestEmbed, avatarTestEmbed] });
      }

      // Dummy Chat Logs (Delete & Edit)
      const chatLogChannel = message.guild.channels.cache.get(CHAT_LOG_CHANNEL_ID);
      const deleteEmbed = new EmbedBuilder()
        .setColor('#ED4245')
        .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL(), url: `https://discord.com/users/${message.author.id}` })
        .setDescription(`**Message deleted in <#${message.channel.id}>**\n\nThis is a simulated deleted message.\n\n**Message ID:** ${message.id}`)
        .setFooter({ text: `ID: ${message.author.id}` }).setTimestamp();
      
      const editEmbed = new EmbedBuilder()
        .setColor('#00A8FC')
        .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL(), url: `https://discord.com/users/${message.author.id}` })
        .setDescription(`**Message edited in <#${message.channel.id}>** [Jump to Message](${message.url})\n\n**Before:** Original test text\n**After:** Edited test text\n\n**Message ID:** ${message.id}`)
        .setFooter({ text: `ID: ${message.author.id}` }).setTimestamp();
      
      if (chatLogChannel) {
        await chatLogChannel.send({ embeds: [deleteEmbed, editEmbed] });
      }

      // Dummy Voice Log
      const voiceLogChannel = message.guild.channels.cache.get(VOICE_LOG_CHANNEL_ID);
      const voiceEmbed = new EmbedBuilder()
        .setColor('#57F287')
        .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL(), url: `https://discord.com/users/${message.author.id}` })
        .setDescription(`**Joined voice channel <#123456789012345678>** *(Simulated)*`)
        .setFooter({ text: `ID: ${message.author.id}` }).setTimestamp();
      if (voiceLogChannel) await voiceLogChannel.send({ embeds: [voiceEmbed] });

      // Dummy Ban Log
      const banLogChannel = message.guild.channels.cache.get(BAN_LOG_CHANNEL_ID);
      if (banLogChannel) {
        const banEmbed = new EmbedBuilder()
          .setColor('#ED4245')
          .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL(), url: `https://discord.com/users/${message.author.id}` })
          .setDescription(`**Member Banned**\n\n**Offender:** ${message.author.username} (\`${message.author.id}\`)\n**Reason:** Test ban\n**Responsible Moderator:** ${client.user.tag}`)
          .setFooter({ text: `ID: ${message.author.id}` }).setTimestamp();

        const unbanButton = new ButtonBuilder()
          .setCustomId(`unban_${message.author.id}`)
          .setLabel('UNBAN')
          .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder().addComponents(unbanButton);
        await banLogChannel.send({ embeds: [banEmbed], components: [row] });
      }

      await message.reply({ content: 'Test logs sent!', ephemeral: true });
    } catch (err) {
      console.error(err);
      await message.reply({ content: 'Error sending test logs.', ephemeral: true });
    }
    return;
  }

  // --- MANUAL TWITCH DROPS CHECK (admin) ---
  if (message.content === '!checkdrops') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply({ content: 'You do not have permission to run this command.', ephemeral: true });
    }
    await message.reply('Checking for new GTA Twitch Drops...');
    await checkTwitchDrops(true);
    return;
  }

  // --- HONEYPOT TRAP CHANNEL AUTO-BAN ---
  if (message.channel.id === TRAP_CHANNEL_ID) {
    try {
      await message.delete();
    } catch (err) {
      console.error('Failed to delete honeypot message:', err);
    }
    await executeBan(message.guild, message.author, 'Triggered honeypot channel (trap-channel-4-bots)');
    return;
  }

  // --- ANTI-DISCORD INVITE LINK AUTO-BAN ---
  if (DISCORD_INVITE_REGEX.test(message.content)) {
    try {
      await message.delete();
    } catch (err) {
      console.error('Failed to delete invite message:', err);
    }
    await executeBan(message.guild, message.author, 'Posting unauthorized Discord invite links');
  }
});

// ==========================================
// 9. INTERACTION CREATE (unban + DMO tickets)
// ==========================================
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  // ----- UNBAN BUTTON -----
  if (interaction.customId.startsWith('unban_')) {
    const targetUserId = interaction.customId.split('unban_')[1];

    try {
      await interaction.guild.members.unban(targetUserId, `Manual unban triggered by ${interaction.user.tag}`);

      const disabledButton = new ButtonBuilder()
        .setCustomId(`unbanned_${targetUserId}`)
        .setLabel('UNBANNED')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true);

      const updatedRow = new ActionRowBuilder().addComponents(disabledButton);

      const existingEmbed = interaction.message.embeds[0];
      const updatedEmbed = EmbedBuilder.from(existingEmbed)
        .setColor('#57F287')
        .addFields({ name: 'Status', value: `:white_check_mark: **Unbanned by ${interaction.user.username}**` });

      await interaction.update({ embeds: [updatedEmbed], components: [updatedRow] });
    } catch (error) {
      console.error(`Failed to unban user ID ${targetUserId}:`, error);
      await interaction.reply({ content: `Failed to unban user. They may already be unbanned or the bot lacks permissions.`, ephemeral: true });
    }
    return;
  }

  // ----- OPEN DMO TICKET -----
  if (interaction.customId === 'open_dmo_ticket') {
    await interaction.deferReply({ ephemeral: true });

    const member = interaction.member;

    // Check if user already has an open ticket in the category
    const existing = interaction.guild.channels.cache.find(ch =>
      ch.parentId === DMO_CATEGORY_ID &&
      ch.type === ChannelType.GuildText &&
      (ch.topic === `DMO Ticket for ${member.id}` ||
       ch.permissionOverwrites.cache.some(ow => ow.id === member.id && ow.type === 1))
    );

    if (existing) {
      return interaction.editReply({ content: `You already have an open ticket: ${existing}` });
    }

    const nickname = member.displayName || member.user.username;

    // Make a safe channel name from the nickname
    let channelName = nickname
      .toLowerCase()
      .replace(/[^a-z0-9\-_ ]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 90);

    if (!channelName) channelName = `ticket-${member.user.id}`;

    try {
      const channel = await interaction.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: DMO_CATEGORY_ID,
        topic: `DMO Ticket for ${member.id}`,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
          { id: OWNER_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
          { id: DMO_PRO_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
        ]
      });

      const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('close_dmo_ticket')
          .setLabel('Close / Delete Ticket')
          .setStyle(ButtonStyle.Danger)
      );

      await channel.send({
        content: `<@${member.id}> <@&${OWNER_ROLE_ID}> <@&${DMO_PRO_ROLE_ID}>\n\nPaste your DMO specs from the website below.`,
        components: [closeRow]
      });

      await interaction.editReply({ content: `Ticket created: ${channel}` });
    } catch (err) {
      console.error('Failed to create DMO ticket:', err);
      await interaction.editReply({ content: 'Failed to create ticket. Check bot permissions.' });
    }
    return;
  }

  // ----- CLOSE / DELETE DMO TICKET -----
  if (interaction.customId === 'close_dmo_ticket') {
    const hasStaffRole = interaction.member.roles.cache.has(OWNER_ROLE_ID) || 
                         interaction.member.roles.cache.has(DMO_PRO_ROLE_ID);

    if (!hasStaffRole) {
      return interaction.reply({ content: 'Only Owner or DMO Pro can close tickets.', ephemeral: true });
    }

    await interaction.reply({ content: 'Deleting ticket...', ephemeral: true });
    await interaction.channel.delete().catch(err => console.error('Failed to delete ticket channel:', err));
    return;
  }
});

// ==========================================
// CORE BAN FUNCTION
// ==========================================
async function executeBan(guild, user, reason) {
  try {
    const logChannel = guild.channels.cache.get(BAN_LOG_CHANNEL_ID);

    await guild.members.ban(user.id, { 
      deleteMessageSeconds: 21600, 
      reason: `Auto-ban: ${reason}` 
    });

    const banEmbed = new EmbedBuilder()
      .setColor('#ED4245')
      .setAuthor({ 
        name: user.username, 
        iconURL: user.displayAvatarURL(),
        url: `https://discord.com/users/${user.id}`
      })
      .setDescription(
        `**Member Banned**\n\n` +
        `**Offender:** ${user.username} (\`${user.id}\`)\n` +
        `**Reason:** ${reason}\n` +
        `**Responsible Moderator:** ${client.user.tag}`
      )
      .setFooter({ text: `ID: ${user.id}` })
      .setTimestamp();

    const unbanButton = new ButtonBuilder()
      .setCustomId(`unban_${user.id}`)
      .setLabel('UNBAN')
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder().addComponents(unbanButton);

    if (logChannel) {
      await logChannel.send({ embeds: [banEmbed], components: [row] });
    } else {
      console.log('Could not find the ban logs channel. Verify BAN_LOG_CHANNEL_ID.');
    }
  } catch (error) {
    console.error(`Failed to ban ${user.username}. Check role hierarchy and permissions. Error:`, error);
  }
}

client.login(process.env.TOKEN);
