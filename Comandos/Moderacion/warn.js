const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { db } = require('../../Automatizaciones/firebase');
const axios = require('axios');
const FormData = require('form-data');

// Función para subir a Imgur mediante API
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
        return attachment.url; // Fallback al link de Discord si falla Imgur
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('⚠️ Warnea a un usuario y registra la sanción.')
        .addUserOption(option => 
            option.setName('usuario')
                .setDescription('Usuario a sancionar')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('motivo')
                .setDescription('Motivo de la sanción')
                .setRequired(true))
        .addAttachmentOption(option => 
            option.setName('evidencia')
                .setDescription('Subir evidencia del warn')
                .setRequired(true)),

    async execute(interaction) {
        const user = interaction.options.getUser('usuario');
        const motivo = interaction.options.getString('motivo');
        const evidencia = interaction.options.getAttachment('evidencia');
        const canalSancionesId = '1477387624288354324';
        const logBotId = '1482565635715109015';

        // Pensando... (Defer para evitar timeout por la subida a Imgur)
        await interaction.deferReply({ ephemeral: true });

        // 1. Subir evidencia a Imgur
        const imgurLink = await uploadToImgur(evidencia);

        // 2. Registro en Firebase (Colección específica)
        const warnData = {
            usuarioId: user.id,
            usuarioTag: user.tag,
            moderadorId: interaction.user.id,
            moderadorTag: interaction.user.tag,
            motivo: motivo,
            evidencia: imgurLink,
            fecha: new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })
        };

        await db.collection('sanciones_warns').add(warnData);

        // 3. Crear Embed para el Canal de Sanciones
        const embedPub = new EmbedBuilder()
            .setColor('#ff8c00') // Naranja fuerte (equivalente a ff8c00d5)
            .setTitle(`⚠️ Usuario Warneado - ${user.username}`)
            .addFields(
                { name: '👤 **USUARIO SANCIONADO**', value: `<@${user.id}> (${user.id})`, inline: false },
                { name: '👮 **MODERADOR**', value: `<@${interaction.user.id}>`, inline: true },
                { name: '📝 **MOTIVO**', value: motivo, inline: true }
            )
            .setAuthor({ name: "Anda RP", iconURL: "attachment://LogoPFP.png" })
            .setFooter({ text: 'Anda RP - Rol de calidad', iconURL: "attachment://LogoPFP.png" })
            .setTimestamp();

        // 4. Enviar a canales correspondientes
        const canalSanciones = interaction.guild.channels.cache.get(canalSancionesId);
        const canalLogs = interaction.guild.channels.cache.get(logBotId);

        if (canalSanciones) {
            await canalSanciones.send({ 
                embeds: [embedPub], 
                content: `🖼️ **Evidencia:** ${imgurLink}`,
                files: ['./attachment/LogoPFP.png'] 
            });
        }

        if (canalLogs) {
            await canalLogs.send(`📑 **LOG:** <@${interaction.user.id}> ha aplicado un warn a <@${user.id}>. Motivo: ${motivo}`);
        }

        // 5. Notificar al usuario por MD
        try {
            await user.send({
                content: `⚠️ **Has recibido un aviso en Anda RP**\n\n**Motivo:** ${motivo}\n**Evidencia:** ${imgurLink}\n\n*Si crees que esto es un error, contacta con un superior.*`
            });
        } catch (error) {
            console.log(`No se pudo enviar MD a ${user.tag}`);
        }

        await interaction.editReply({ content: `✅ El usuario **${user.tag}** ha sido warneado correctamente.` });
    }
};