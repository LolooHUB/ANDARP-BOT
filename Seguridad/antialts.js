const { 
    EmbedBuilder, 
    Events, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle 
} = require('discord.js');
const { db } = require('../Automatizaciones/firebase');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        const canalSecurityId = '1492339602420273241';
        const canalSecurity = member.guild.channels.cache.get(canalSecurityId);
        if (!canalSecurity) return;

        const cuentaCreada = member.user.createdTimestamp;
        const antiguedadDias = Math.floor((Date.now() - cuentaCreada) / (1000 * 60 * 60 * 24));

        // Solo activar para cuentas de menos de 7 días o con historial
        const warnsSnap = await db.collection('sanciones_warns').where('usuarioId', '==', member.id).get();
        if (antiguedadDias >= 7 && warnsSnap.size === 0) return;

        const embedAlt = new EmbedBuilder()
            .setColor(antiguedadDias < 3 ? '#ff0000' : '#ffff00')
            .setTitle('🛡️ Alerta de Seguridad: Usuario Sospechoso')
            .setThumbnail(member.user.displayAvatarURL())
            .addFields(
                { name: '👤 Usuario', value: `${member.user.tag} (\`${member.id}\`)`, inline: false },
                { name: '📅 Antigüedad', value: `${antiguedadDias} días`, inline: true },
                { name: '📊 Warns Previos', value: `${warnsSnap.size}`, inline: true }
            )
            .setFooter({ text: 'Seleccione una acción para gestionar al usuario.' })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`info_${member.id}`)
                .setLabel('Ver Info User')
                .setEmoji('🔍')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`kick_${member.id}`)
                .setLabel('Expulsar')
                .setEmoji('👞')
                .setStyle(ButtonStyle.Danger)
        );

        await canalSecurity.send({ 
            content: `⚠️ **Posible Alt detectada:** <@${member.id}>`,
            embeds: [embedAlt], 
            components: [row] 
        });
    }
};