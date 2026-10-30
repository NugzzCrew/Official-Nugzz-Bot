require('dotenv').config();
const { 
  Client, 
  GatewayIntentBits, 
  Events, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  EmbedBuilder 
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
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

// Regex pattern matching all Discord invite formats
const DISCORD_INVITE_REGEX = /(https?:\/\/)?(www\.)?(discord\.(gg|io|me|li)|discord(app)?\.com\/invite)\/[a-zA-Z0-9\-]+/i;

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}!`);
  console.log('Bot is online and ready.');
});

// ==========================================
// 1. WELCOME CHANNEL: MEMBER JOIN
// ==========================================
client.on(Events.GuildMemberAdd, async (member) => {
  if (member.guild.id !== GUILD_ID) return;

  const welcomeChannel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
  if (!welcomeChannel) return;

  const createdUnix = Math.floor(member.user.createdTimestamp / 1000);

  const joinEmbed = new EmbedBuilder()
    .setColor('#D4AF37') // Official Nugzz Gold accent
    .setAuthor({ 
      name: member.user.username, 
      iconURL: member.user.displayAvatarURL(),
      url: `https://discord.com/users/${member.id}`
    })
    .setDescription(
      `**Member Joined**\n` +
      `<@${member.id}> joined the server.\n\n` +
      `**Account Creation:** <t:${createdUnix}:R> (<t:${createdUnix}:D>)`
    )
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

  const leaveEmbed = new EmbedBuilder()
    .setColor('#ED4245') // Red accent
    .setAuthor({ 
      name: member.user.username, 
      iconURL: member.user.displayAvatarURL(),
      url: `https://discord.com/users/${member.id}`
    })
    .setDescription(`**Member Left**\n<@${member.id}> left or was removed from the server.`)
    .setFooter({ text: `ID: ${member.id}` })
    .setTimestamp();

  await generalLogChannel.send({ embeds: [leaveEmbed] });
});

// ==========================================
// 3. CHAT LOGS: MESSAGE DELETION
// ==========================================
client.on(Events.MessageDelete, async (message) => {
  if (message.guild?.id !== GUILD_ID || message.author?.bot) return;

  const chatLogChannel = message.guild.channels.cache.get(CHAT_LOG_CHANNEL_ID);
  if (!chatLogChannel) return;

  const content = message.content ? message.content : '*[No text content or uncached message]*';

  const deleteEmbed = new EmbedBuilder()
    .setColor('#ED4245') // Red accent
    .setAuthor({ 
      name: message.author?.username || 'Unknown', 
      iconURL: message.author?.displayAvatarURL(),
      url: message.author ? `https://discord.com/users/${message.author.id}` : undefined
    })
    .setDescription(
      `**Message deleted in <#${message.channel.id}>**\n\n` +
      `${content}\n\n` +
      `**Message ID:** ${message.id}`
    )
    .setFooter({ text: `ID: ${message.author?.id || 'Unknown'}` })
    .setTimestamp();

  await chatLogChannel.send({ embeds: [deleteEmbed] });
});

// ==========================================
// 4. CHAT LOGS: MESSAGE EDIT
// ==========================================
client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
  if (newMessage.guild?.id !== GUILD_ID || newMessage.author?.bot) return;
  if (oldMessage.content === newMessage.content) return;

  const chatLogChannel = newMessage.guild.channels.cache.get(CHAT_LOG_CHANNEL_ID);
  if (!chatLogChannel) return;

  const oldContent = oldMessage.content ? oldMessage.content : '*[Uncached original message]*';
  const newContent = newMessage.content ? newMessage.content : '*[No text content]*';

  const editEmbed = new EmbedBuilder()
    .setColor('#00A8FC') // Blue accent
    .setAuthor({ 
      name: newMessage.author.username, 
      iconURL: newMessage.author.displayAvatarURL(),
      url: `https://discord.com/users/${newMessage.author.id}`
    })
    .setDescription(
      `**Message edited in <#${newMessage.channel.id}>** [Jump to Message](${newMessage.url})\n\n` +
      `**Before:** ${oldContent}\n` +
      `**After:** ${newContent}\n\n` +
      `**Message ID:** ${newMessage.id}`
    )
    .setFooter({ text: `ID: ${newMessage.author.id}` })
    .setTimestamp();

  await chatLogChannel.send({ embeds: [editEmbed] });
});

// ==========================================
// 5. VOICE LOGS: JOIN / LEAVE / MOVE
// ==========================================
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  if (newState.guild.id !== GUILD_ID || newState.member.user.bot) return;

  const voiceLogChannel = newState.guild.channels.cache.get(VOICE_LOG_CHANNEL_ID);
  if (!voiceLogChannel) return;

  const member = newState.member;
  const embed = new EmbedBuilder()
    .setAuthor({ 
      name: member.user.username, 
      iconURL: member.user.displayAvatarURL(),
      url: `https://discord.com/users/${member.id}`
    })
    .setFooter({ text: `ID: ${member.id}` })
    .setTimestamp();

  if (!oldState.channelId && newState.channelId) {
    embed
      .setColor('#57F287') // Green accent
      .setDescription(`**Joined voice channel <#${newState.channelId}>**`);
  } else if (oldState.channelId && !newState.channelId) {
    embed
      .setColor('#ED4245') // Red accent
      .setDescription(`**Left voice channel <#${oldState.channelId}>**`);
  } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
    embed
      .setColor('#00A8FC') // Blue accent
      .setDescription(
        `**Moved voice channels**\n` +
        `**From:** <#${oldState.channelId}>\n` +
        `**To:** <#${newState.channelId}>`
      );
  } else {
    return;
  }

  await voiceLogChannel.send({ embeds: [embed] });
});

// ==========================================
// 6. ONBOARDING AUTO-BAN LISTENER
// ==========================================
client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  if (newMember.guild.id !== GUILD_ID) return;

  if (!oldMember.roles.cache.has(DUMBASS_ROLE_ID) && newMember.roles.cache.has(DUMBASS_ROLE_ID)) {
    await executeBan(newMember.guild, newMember.user, 'Not following socials');
  } else if (!oldMember.roles.cache.has(UNDERAGE_ROLE_ID) && newMember.roles.cache.has(UNDERAGE_ROLE_ID)) {
    await executeBan(newMember.guild, newMember.user, 'Underage (16 and under)');
  }
});

// ==========================================
// 7. MESSAGE LISTENERS: HONEYPOT & INVITE LINK AUTO-BAN
// ==========================================
client.on(Events.MessageCreate, async (message) => {
  if (message.guild?.id !== GUILD_ID || message.author.bot) return;

  // Honeypot Trap Channel Auto-Ban
  if (message.channel.id === TRAP_CHANNEL_ID) {
    try {
      await message.delete();
    } catch (err) {
      console.error('Failed to delete honeypot message:', err);
    }
    await executeBan(message.guild, message.author, 'Triggered honeypot channel (trap-channel-4-bots)');
    return;
  }

  // Anti-Discord Invite Link Auto-Ban
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
// 8. UNBAN BUTTON INTERACTION LISTENER
// ==========================================
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

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
        .setColor('#57F287') // Green accent
        .addFields({ 
          name: 'Status', 
          value: `:white_check_mark: **Unbanned by ${interaction.user.username}**` 
        });

      await interaction.update({
        embeds: [updatedEmbed],
        components: [updatedRow]
      });
    } catch (error) {
      console.error(`Failed to unban user ID ${targetUserId}:`, error);
      await interaction.reply({
        content: `Failed to unban user. They may already be unbanned or the bot lacks permissions.`,
        ephemeral: true
      });
    }
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
        `**Offender:** ${user.username} (<@${user.id}>)\n` +
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
      await logChannel.send({
        embeds: [banEmbed],
        components: [row]
      });
    } else {
      console.log('Could not find the ban logs channel. Verify BAN_LOG_CHANNEL_ID.');
    }
  } catch (error) {
    console.error(`Failed to ban ${user.username}. Check role hierarchy and permissions. Error:`, error);
  }
}

client.login(process.env.TOKEN);