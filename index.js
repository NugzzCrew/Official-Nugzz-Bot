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
    GatewayIntentBits.GuildMembers
  ]
});

// Configuration IDs
const GUILD_ID = '999413076505936023';
const DUMBASS_ROLE_ID = '1348346119092048023';
const UNDERAGE_ROLE_ID = '1332829647028617308';
const TRAP_CHANNEL_ID = '1522621788809330832';
const LOG_CHANNEL_ID = '1391912641529774161';

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}!`);
  console.log('Bot is online and ready.');
});

// Listener 1: Onboarding Role Auto-Ban
client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  if (newMember.guild.id !== GUILD_ID) return;

  if (!oldMember.roles.cache.has(DUMBASS_ROLE_ID) && newMember.roles.cache.has(DUMBASS_ROLE_ID)) {
    await executeBan(newMember.guild, newMember.user, 'Not following socials');
  } 
  else if (!oldMember.roles.cache.has(UNDERAGE_ROLE_ID) && newMember.roles.cache.has(UNDERAGE_ROLE_ID)) {
    await executeBan(newMember.guild, newMember.user, 'Underage (16 and under)');
  }
});

// Listener 2: Honeypot Channel Auto-Ban
client.on(Events.MessageCreate, async (message) => {
  if (message.guild?.id !== GUILD_ID || message.channel.id !== TRAP_CHANNEL_ID || message.author.bot) return;

  try {
    await message.delete();
  } catch (err) {
    console.error('Failed to delete honeypot message:', err);
  }

  await executeBan(message.guild, message.author, 'Triggered honeypot channel (trap-channel-4-bots)');
});

// Listener 3: Green UNBAN Button Interaction
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId.startsWith('unban_')) {
    const targetUserId = interaction.customId.split('unban_')[1];

    try {
      // Execute unban in Discord
      await interaction.guild.members.unban(targetUserId, `Manual unban triggered by ${interaction.user.tag}`);

      // Disable the button
      const disabledButton = new ButtonBuilder()
        .setCustomId(`unbanned_${targetUserId}`)
        .setLabel('UNBANNED')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true);

      const updatedRow = new ActionRowBuilder().addComponents(disabledButton);

      // Update the original embed to reflect who unbanned the user
      const existingEmbed = interaction.message.embeds[0];
      const updatedEmbed = EmbedBuilder.from(existingEmbed)
        .setColor('#57F287') // Change color accent to Green
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

// Core Ban Function with Styled Embed Logging and UNBAN Button
async function executeBan(guild, user, reason) {
  try {
    const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);

    // Ban member and purge all messages from the last 6 hours (21600 seconds)
    await guild.members.ban(user.id, { 
      deleteMessageSeconds: 21600, 
      reason: `Auto-ban: ${reason}` 
    });

    // Build Carl-bot style embed log
    const banEmbed = new EmbedBuilder()
      .setColor('#ED4245') // Dark Red accent color bar
      .setAuthor({ name: 'ban' })
      .setDescription(
        `**Offender:** ${user.username} <@${user.id}>\n` +
        `**Reason:** ${reason}\n` +
        `**Responsible moderator:** ${client.user.tag}`
      )
      .setFooter({ text: `ID: ${user.id}` })
      .setTimestamp();

    // Build green UNBAN button
    const unbanButton = new ButtonBuilder()
      .setCustomId(`unban_${user.id}`)
      .setLabel('UNBAN')
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder().addComponents(unbanButton);

    // Send log entry
    if (logChannel) {
      await logChannel.send({
        embeds: [banEmbed],
        components: [row]
      });
    } else {
      console.log('Could not find the logs channel. Verify LOG_CHANNEL_ID.');
    }
  } catch (error) {
    console.error(`Failed to ban ${user.username}. Check role hierarchy and permissions. Error:`, error);
  }
}

client.login(process.env.TOKEN);