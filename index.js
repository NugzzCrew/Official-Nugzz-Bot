require('dotenv').config();
const { Client, GatewayIntentBits, Events } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}!`);
  console.log('Bot is online and ready.');
});

client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  const dumbassRoleId = '1348346119092048023';
  const underageRoleId = '1332829647028617308';
  const logChannelId = '1391912641529774161';

  if (!oldMember.roles.cache.has(dumbassRoleId) && newMember.roles.cache.has(dumbassRoleId)) {
    await executeBan(newMember, logChannelId, 'Not following socials');
  }
  
  else if (!oldMember.roles.cache.has(underageRoleId) && newMember.roles.cache.has(underageRoleId)) {
    await executeBan(newMember, logChannelId, '16 and under');
  }
});

async function executeBan(member, logChannelId, reason) {
  try {
    const logChannel = member.guild.channels.cache.get(logChannelId);
    
    await member.ban({ reason: `Auto-ban via Onboarding: ${reason}` });
    
    if (logChannel) {
      await logChannel.send(`**${member.user.username}** (${member.user.id}) has been banned for: ${reason}.`);
    } else {
      console.log('Could not find the logs channel. Check the channel ID.');
    }
  } catch (error) {
    console.error(`Failed to ban ${member.user.username}. Check bot permissions and role hierarchy. Error:`, error);
  }
}

client.login(process.env.TOKEN);