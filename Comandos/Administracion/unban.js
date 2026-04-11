const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../Automatizaciones/firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('🔓 Revoca el baneo de un usuario y lo quita de la Blacklist.')
        .addStringOption(opt => 
            opt.setName('id')
                .setDescription('ID de Discord del usuario a desbanear')
                .setRequired(true))
        .addStringOption(opt => 
            opt.setName('motivo')
                .setDescription('Motivo de la revocación')
                .setRequired(true)),

    async execute(interaction) {
        // --- 🛡️ CONTROL DE ACCESO RESTRINGIDO (HIGH STAFF ONLY) ---
        const staffHierarchy = [
            '1476768019496829033', // [6] Supervision Avanzada
            '1476768122915782676', // [7] Manager
            '1476768405037125885', // [8] Community Manager
            '1476768951034970253'  // [9] Fundacion
        ];

        const tienePermiso = interaction.member.roles.cache.some(role => staffHierarchy.includes(role.id));

        if (!tienePermiso) {
            return interaction.reply({ 
                content: '❌ No tienes rango suficiente para revocar sanciones globales (Mínimo: Supervisión Avanzada).', 
                ephemeral: true 
            });
        }
        // ---------------------------------------------------------

        const userId = interaction.options.getString('id');
        const motivo = interaction.options.getString('motivo');
        const canalBlacklistId = '1476760068199415888';
        const logBotId = '1482565635715109015';

        await interaction.deferReply({ ephemeral: true });

        try {
            // 1. Intentar desbanear en Discord
            await interaction.guild.members.unban(userId, motivo);

            // 2. Limpiar registro de Blacklist en Firebase
            const blacklistRef = db.collection('blacklist').doc(userId);
            const doc = await blacklistRef.get();
            if (doc.exists) { 
                await blacklistRef.delete(); 
            }

            // 3. Crear Embed de Revocación
            const embedUnban = new EmbedBuilder()
                .setColor('#00ff00') 
                .setTitle(`🔓 Sanción Revocada - ID: ${userId}`)
                .setDescription(`**MODERADOR :** <@${interaction.user.id}>\n\n**MOTIVO :** ${motivo}`)
                .setAuthor({ name: 'Sistema de Sanciones', iconURL: 'attachment://LogoPFP.png' })
                .setFooter({ text: 'Anda RP - Rol de calidad', iconURL: 'attachment://LogoPFP.png' })
                .setTimestamp();

            // 4. Enviar a Canales
            const canalBlacklist = interaction.guild.channels.cache.get(canalBlacklistId);
            const canalLogs = interaction.guild.channels.cache.get(logBotId);

            if (canalBlacklist) {
                await canalBlacklist.send({ 
                    content: `✅ **USUARIO ELIMINADO DE LA BLACKLIST**`,
                    embeds: [embedUnban], 
                    files: ['./attachment/LogoPFP.png'] 
                });
            }

            if (canalLogs) {
                await canalLogs.send(`📑 **LOG UNBAN:** <@${interaction.user.id}> ha desbaneado a la ID \`${userId}\`.`);
            }

            await interaction.editReply({ content: `✅ El usuario con ID \`${userId}\` ha sido desbaneado y eliminado de la Blacklist.` });

        } catch (error) {
            console.error(error);
            if (error.code === 10007 || error.code === 50035 || error.code === 10013) {
                return interaction.editReply({ content: "❌ No se pudo encontrar un baneo activo para esa ID o la ID es inválida." });
            }
            await interaction.editReply({ content: "❌ Hubo un error al procesar el desbaneo." });
        }
    }
};