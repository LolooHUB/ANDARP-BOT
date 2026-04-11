const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../Automatizaciones/firebase');
const axios = require('axios');
const FormData = require('form-data');

// Función para subir a ImgBB mediante API
async function uploadToImgBB(attachment) {
    try {
        const formData = new FormData();
        formData.append('image', attachment.url);
        
        const apiKey = process.env.APIKEY_IMGBB; 
        
        const response = await axios.post(`https://api.imgbb.com/1/upload?key=${apiKey}`, formData, {
            headers: {
                ...formData.getHeaders()
            }
        });
        return response.data.data.url; 
    } catch (error) {
        console.error('Error al subir a ImgBB:', error.response ? error.response.data : error.message);
        return attachment.url; 
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('🚨 Expulsa a un usuario del servidor.')
        .addUserOption(opt => opt.setName('usuario').setDescription('Usuario a expulsar').setRequired(true))
        .addStringOption(opt => opt.setName('motivo').setDescription('Motivo de la expulsión').setRequired(true))
        .addAttachmentOption(opt => opt.setName('evidencia').setDescription('Prueba visual del kick').setRequired(true)),

    async execute(interaction) {
        // --- 🛡️ CONTROL DE ACCESO (STAFF HIERARCHY) ---
        const staffHierarchy = [
            '1476766248242118697', // [1] Mod en pruebas
            '1476766796861149284', // [2] Mod
            '1476767536530849822', // [3] Supervision basica
            '1476767750625038336', // [4] Administrador
            '1482153188856434828', // [5] Compras
            '1476768019496829033', // [6] Supervision Avanzada
            '1476768122915782676', // [7] Manager
            '1476768405037125885', // [8] Community Manager
            '1476768951034970253'  // [9] Fundacion
        ];

        const tienePermiso = interaction.member.roles.cache.some(role => staffHierarchy.includes(role.id));

        if (!tienePermiso) {
            return interaction.reply({ 
                content: '❌ No tienes los permisos suficientes (Staff) para ejecutar este comando.', 
                ephemeral: true 
            });
        }
        // ----------------------------------------------

        const user = interaction.options.getUser('usuario');
        const member = interaction.options.getMember('usuario');
        const motivo = interaction.options.getString('motivo');
        const evidencia = interaction.options.getAttachment('evidencia');
        
        const canalSancionesId = '1477387624288354324';
        const logBotId = '1482565635715109015';

        if (!member) return interaction.reply({ content: "❌ El usuario no está en el servidor.", ephemeral: true });
        
        // Verificación de jerarquía de Discord (No puede kickear a alguien con rol superior al bot)
        if (!member.kickable) return interaction.reply({ content: "❌ No tengo permisos suficientes para expulsar a este usuario (puede que su rol sea superior al mío).", ephemeral: true });

        await interaction.deferReply({ ephemeral: true });

        // 1. Subir a ImgBB
        const imgbbLink = await uploadToImgBB(evidencia);
        const fechaKick = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });

        // 2. Registro en Firebase
        const kickData = {
            usuarioId: user.id,
            usuarioTag: user.tag,
            moderadorId: interaction.user.id,
            moderadorTag: interaction.user.tag,
            motivo: motivo,
            evidencia: imgbbLink,
            fecha: fechaKick,
            tipo: 'KICK'
        };
        await db.collection('sanciones_kicks').add(kickData);

        // 3. Embed del Canal de Sanciones
        const embedKick = new EmbedBuilder()
            .setColor('#ff8c00') 
            .setTitle(`🚨 Usuario Kickeado - ${user.username}`)
            .setDescription(`**USUARIO :** <@${user.id}>\n**MODERADOR :** <@${interaction.user.id}>\n\n**MOTIVO :** ${motivo}`)
            .setAuthor({ name: 'Sistema de Sanciones', iconURL: 'attachment://LogoPFP.png' })
            .setFooter({ text: 'Anda RP - Rol de calidad', iconURL: 'attachment://LogoPFP.png' })
            .setTimestamp();

        // 4. Notificación al usuario por MD
        try {
            await user.send(`🚨 **Has sido expulsado de Anda RP**\n\n**Motivo:** ${motivo}\n**Evidencia:** ${imgbbLink}`);
        } catch (e) {
            console.log("No se pudo enviar MD al usuario.");
        }

        // 5. Ejecución física del Kick
        await member.kick(motivo);

        const canalSanciones = interaction.guild.channels.cache.get(canalSancionesId);
        const canalLogs = interaction.guild.channels.cache.get(logBotId);

        if (canalSanciones) {
            await canalSanciones.send({ 
                embeds: [embedKick], 
                content: `🔗 **Evidencia:** ${imgbbLink}`, 
                files: ['./attachment/LogoPFP.png'] 
            });
        }

        if (canalLogs) {
            await canalLogs.send(`🚨 **LOG KICK:** <@${interaction.user.id}> expulsó a **${user.tag}**. Motivo: ${motivo}`);
        }

        await interaction.editReply({ content: `✅ **${user.tag}** ha sido expulsado y registrado correctamente.` });
    }
};