const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../../Automatizaciones/firebase');
const axios = require('axios');
const FormData = require('form-data');

// Función para subir a Imgur (Mechanical Necessity para la evidencia)
async function uploadToImgur(attachment) {
    try {
        const formData = new FormData();
        formData.append('image', attachment.url);
        const response = await axios.post('https://api.imgur.com/3/image', formData, {
            headers: {
                Authorization: `Client-ID ${process.env.IMGUR_CLIENT_ID}`,
                ...formData.getHeaders()
            }
        });
        return response.data.data.link;
    } catch (error) {
        console.error('Error al subir a Imgur:', error);
        return attachment.url;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('🚨 Expulsa a un usuario del servidor.')
        .addUserOption(opt => opt.setName('usuario').setDescription('Usuario a expulsar').setRequired(true))
        .addStringOption(opt => opt.setName('motivo').setDescription('Motivo de la expulsión').setRequired(true))
        .addAttachmentOption(opt => opt.setName('evidencia').setDescription('Prueba visual del kick').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers), // Acceso para Mods y Admins con este permiso

    async execute(interaction) {
        const user = interaction.options.getUser('usuario');
        const member = interaction.options.getMember('usuario');
        const motivo = interaction.options.getString('motivo');
        const evidencia = interaction.options.getAttachment('evidencia');
        
        const canalSancionesId = '1477387624288354324';
        const logBotId = '1482565635715109015';

        if (!member) return interaction.reply({ content: "❌ El usuario no está en el servidor.", ephemeral: true });
        if (!member.kickable) return interaction.reply({ content: "❌ No tengo permisos para expulsar a este usuario.", ephemeral: true });

        await interaction.deferReply({ ephemeral: true });

        // 1. Subir a Imgur
        const imgurLink = await uploadToImgur(evidencia);
        const fechaKick = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });

        // 2. Registro en Firebase (Persistencia)
        const kickData = {
            usuarioId: user.id,
            usuarioTag: user.tag,
            moderadorId: interaction.user.id,
            motivo: motivo,
            evidencia: imgurLink,
            fecha: fechaKick,
            tipo: 'KICK'
        };
        await db.collection('sanciones_kicks').add(kickData);

        // 3. Embed del Canal de Sanciones (TAL CUAL EL PROMPT)
        const embedKick = new EmbedBuilder()
            .setColor('#ff8c00') // Naranja Sanción
            .setTitle(`🚨 Usuario Kickeado - ${user.username}`)
            .setDescription(`**MODERADOR :** <@${interaction.user.id}>\n\n**MOTIVO :** ${motivo}`)
            .setAuthor({ name: 'Sistema de Sanciones', iconURL: 'attachment://LogoPFP.png' })
            .setFooter({ text: 'Anda RP - Rol de calidad', iconURL: 'attachment://LogoPFP.png' })
            .setTimestamp();

        // 4. Notificación al usuario por MD (Antes del kick)
        try {
            await user.send(`🚨 **Has sido expulsado de Anda RP**\n\n**Motivo:** ${motivo}\n**Evidencia:** ${imgurLink}`);
        } catch (e) {
            console.log("No se pudo enviar MD al usuario.");
        }

        // 5. Ejecución y Logs
        await member.kick(motivo);

        const canalSanciones = interaction.guild.channels.cache.get(canalSancionesId);
        const canalLogs = interaction.guild.channels.cache.get(logBotId);

        if (canalSanciones) {
            await canalSanciones.send({ 
                embeds: [embedKick], 
                content: `🔗 **Evidencia:** ${imgurLink}`, 
                files: ['./attachment/LogoPFP.png'] 
            });
        }

        if (canalLogs) {
            await canalLogs.send(`🚨 **LOG KICK:** <@${interaction.user.id}> expulsó a **${user.tag}**. Motivo: ${motivo}`);
        }

        await interaction.editReply({ content: `✅ **${user.tag}** ha sido expulsado y registrado.` });
    }
};