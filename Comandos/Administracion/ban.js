const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../Automatizaciones/firebase');
const axios = require('axios');
const FormData = require('form-data');

// Función para subir a ImgBB mediante API (Reemplazando Imgur)
async function uploadToImgBB(attachment) {
    try {
        const formData = new FormData();
        formData.append('image', attachment.url);
        
        // Usamos el secret APIKEY_IMGBB
        const apiKey = process.env.APIKEY_IMGBB; 
        
        const response = await axios.post(`https://api.imgbb.com/1/upload?key=${apiKey}`, formData, {
            headers: {
                ...formData.getHeaders()
            }
        });
        return response.data.data.url; 
    } catch (error) {
        console.error('Error al subir a ImgBB:', error.response ? error.response.data : error.message);
        return attachment.url; // Fallback al link de Discord si falla
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('🚫 Banea a un usuario y lo añade a la Blacklist.')
        .addUserOption(opt => opt.setName('usuario').setDescription('Usuario a banear').setRequired(true))
        .addStringOption(opt => opt.setName('motivo').setDescription('Motivo del baneo').setRequired(true))
        .addAttachmentOption(opt => opt.setName('evidencia').setDescription('Prueba visual del ban').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction) {
        const user = interaction.options.getUser('usuario');
        const member = interaction.options.getMember('usuario');
        const motivo = interaction.options.getString('motivo');
        const evidencia = interaction.options.getAttachment('evidencia');
        
        const canalSancionesId = '1477387624288354324';
        const canalBlacklistId = '1476760068199415888';

        // Verificación de jerarquía
        if (member && !member.bannable) {
            return interaction.reply({ content: "❌ No puedo banear a este usuario (Rango superior).", ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        // 1. Subir a ImgBB
        const imgbbLink = await uploadToImgBB(evidencia);
        const fechaBan = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });

        // 2. Registro en Firebase (Blacklist y Logs)
        const banData = {
            usuarioId: user.id,
            usuarioTag: user.tag,
            moderadorId: interaction.user.id,
            motivo: motivo,
            evidencia: imgbbLink,
            fecha: fechaBan,
            tipo: 'BAN_PERMANENTE'
        };

        // Guardamos en la colección de Blacklist para persistencia total
        await db.collection('blacklist').doc(user.id).set(banData);
        await db.collection('sanciones_bans').add(banData);

        // 3. Crear Embed de Sanción
        const embedBan = new EmbedBuilder()
            .setColor('#ff0000') // Rojo para Bans
            .setTitle(`🚫 Usuario Baneado - ${user.username}`)
            .setDescription(`**MODERADOR :** <@${interaction.user.id}>\n\n**MOTIVO :** ${motivo}`)
            .setAuthor({ name: 'Sistema de Sanciones', iconURL: 'attachment://LogoPFP.png' })
            .setFooter({ text: 'Anda RP - Rol de calidad', iconURL: 'attachment://LogoPFP.png' })
            .setTimestamp();

        // 4. Notificación por MD antes del Ban
        try {
            await user.send(`🚫 **Has sido baneado permanentemente de Anda RP**\n\n**Motivo:** ${motivo}\n**Evidencia:** ${imgbbLink}`);
        } catch (e) {
            console.log("No se pudo enviar el MD de baneo.");
        }

        // 5. Ejecutar Ban y enviar a canales
        await interaction.guild.members.ban(user.id, { reason: motivo });

        const canalSanciones = interaction.guild.channels.cache.get(canalSancionesId);
        const canalBlacklist = interaction.guild.channels.cache.get(canalBlacklistId);

        if (canalSanciones) {
            await canalSanciones.send({ 
                embeds: [embedBan], 
                content: `🔗 **Evidencia:** ${imgbbLink}`, 
                files: ['./attachment/LogoPFP.png'] 
            });
        }

        if (canalBlacklist) {
            await canalBlacklist.send(`🚫 **NUEVA BLACKLIST:** El usuario **${user.tag}** (${user.id}) ha sido vetado permanentemente por <@${interaction.user.id}>.`);
        }

        await interaction.editReply({ content: `✅ **${user.tag}** ha sido baneado y registrado en la Blacklist.` });
    }
};