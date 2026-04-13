/**
 * 🚨 MÓDULO DE SANCIONES - KICK v2.5
 * ---------------------------------------------------------
 * SISTEMA DE EXPULSIÓN CON REGISTRO EN FIREBASE E IMGBB
 * ---------------------------------------------------------
 */

const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { db } = require('../Automatizaciones/firebase');
const axios = require('axios');
const FormData = require('form-data');

// --- 🛠️ CONFIGURACIÓN DE IDS ---
const CANAL_SANCIONES = '1477387624288354324';
const CANAL_LOGS = '1482565635715109015';
const RUTA_LOGO = './attachment/LogoPFP.png';

const staffHierarchy = [
    '1476766248242118697', '1476766796861149284', '1476767536530849822',
    '1476767750625038336', '1482153188856434828', '1476768019496829033',
    '1476768122915782676', '1476768405037125885', '1476768951034970253'
];

// --- 📷 UTILIDAD IMGBB ---
async function uploadToImgBB(attachment) {
    if (!attachment) return null;
    try {
        const formData = new FormData();
        formData.append('image', attachment.url);
        const apiKey = process.env.APIKEY_IMGBB; 
        const response = await axios.post(`https://api.imgbb.com/1/upload?key=${apiKey}`, formData);
        return response.data.data.url; 
    } catch (error) {
        console.error('Error ImgBB:', error.message);
        return attachment.url; 
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('🚨 Expulsa a un usuario del servidor con registro formal.')
        .addUserOption(opt => opt.setName('usuario').setDescription('Sujeto a expulsar').setRequired(true))
        .addStringOption(opt => opt.setName('motivo').setDescription('Razón de la sanción').setRequired(true))
        .addAttachmentOption(opt => opt.setName('evidencia').setDescription('Prueba visual').setRequired(true)),

    async execute(interaction) {
        // 1. Verificación de Permisos
        if (!interaction.member.roles.cache.some(role => staffHierarchy.includes(role.id))) {
            return interaction.reply({ content: '❌ No perteneces a la jerarquía de Staff autorizada.', ephemeral: true });
        }

        const user = interaction.options.getUser('usuario');
        const member = interaction.options.getMember('usuario');
        const motivo = interaction.options.getString('motivo');
        const evidencia = interaction.options.getAttachment('evidencia');

        // 2. Validaciones Previas
        if (!member) return interaction.reply({ content: "❌ El usuario ya no se encuentra en el servidor.", ephemeral: true });
        if (!member.kickable) return interaction.reply({ content: "❌ No puedo expulsar a este usuario. (Jerarquía superior o falta de permisos).", ephemeral: true });

        await interaction.deferReply({ ephemeral: true });

        // 3. Procesamiento de Evidencia y Datos
        const imgbbLink = await uploadToImgBB(evidencia);
        const fechaEspana = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });

        // Consultar cuántas veces ha sido kickeado antes (opcional, para el historial)
        const historialSnap = await db.collection('sanciones_kicks').where('usuarioId', '==', user.id).get();
        const numKicks = historialSnap.size + 1;

        // 4. Registro en Firebase
        const docRef = await db.collection('sanciones_kicks').add({
            usuarioId: user.id,
            usuarioTag: user.tag,
            moderadorId: interaction.user.id,
            motivo: motivo,
            evidencia: imgbbLink,
            fecha: fechaEspana,
            incidencia: numKicks,
            tipo: 'KICK'
        });

        const casoId = docRef.id.slice(-6).toUpperCase();

        // 5. Notificación MD al Usuario
        const embedUser = new EmbedBuilder()
            .setColor('#ff4d4d')
            .setTitle('🚨 NOTIFICACIÓN DE EXPULSIÓN')
            .setDescription(`Has sido expulsado del servidor **Anda RP**.`)
            .addFields(
                { name: '📝 Motivo', value: motivo },
                { name: '🆔 Caso', value: `#${casoId}`, inline: true },
                { name: '📷 Evidencia', value: `[Ver Prueba](${imgbbLink})`, inline: true }
            )
            .setFooter({ text: 'Puedes intentar reingresar si cumples las normativas.' });

        try { await user.send({ embeds: [embedUser] }); } catch (e) { console.log("MD bloqueado."); }

        // 6. Ejecución del Kick
        await member.kick(`Caso #${casoId} | Mod: ${interaction.user.tag} | Motivo: ${motivo}`);

        // 7. Embed para el Canal de Sanciones
        const embedStaff = new EmbedBuilder()
            .setColor('#e67e22')
            .setTitle(`🚨 KICK EJECUTADO - #${casoId}`)
            .setThumbnail(user.displayAvatarURL())
            .addFields(
                { name: '👤 USUARIO', value: `${user} (\`${user.id}\`)`, inline: true },
                { name: '👮 MODERADOR', value: `${interaction.user}`, inline: true },
                { name: '📊 REINCIDENCIA', value: `Expulsión N°${numKicks}`, inline: true },
                { name: '📝 MOTIVO', value: motivo, inline: false }
            )
            .setImage(imgbbLink)
            .setFooter({ text: 'Anda RP • Registro de Disciplina' })
            .setTimestamp();

        const canalSanciones = interaction.guild.channels.cache.get(CANAL_SANCIONES);
        if (canalSanciones) {
            await canalSanciones.send({ embeds: [embedStaff] });
        }

        // 8. Log del Bot
        const canalLogs = interaction.guild.channels.cache.get(CANAL_LOGS);
        if (canalLogs) {
            await canalLogs.send(`🛡️ **LOG KICK:** \`${interaction.user.tag}\` expulsó a \`${user.tag}\`. Motivo: ${motivo}`);
        }

        await interaction.editReply({ content: `✅ **Expulsión registrada.** Caso #${casoId} aplicado a ${user.tag}.` });
    }
};