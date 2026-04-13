const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../Automatizaciones/firebase');
const axios = require('axios');
const FormData = require('form-data');

const CANAL_SANCIONES = '1477387624288354324';
const staffHierarchy = ['1476766248242118697', '1476766796861149284', '1476767536530849822', '1476767750625038336', '1482153188856434828', '1476768019496829033', '1476768122915782676', '1476768405037125885', '1476768951034970253'];

async function uploadToImgBB(attachment) {
    if (!attachment) return null;
    try {
        const formData = new FormData();
        formData.append('image', attachment.url);
        const response = await axios.post(`https://api.imgbb.com/1/upload?key=${process.env.APIKEY_IMGBB}`, formData);
        return response.data.data.url;
    } catch (error) {
        return attachment.url;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('⚠️ Aplica una advertencia formal a un usuario.')
        .addUserOption(opt => opt.setName('usuario').setDescription('Usuario a sancionar').setRequired(true))
        .addStringOption(opt => opt.setName('motivo').setDescription('Motivo detallado').setRequired(true))
        .addAttachmentOption(opt => opt.setName('evidencia').setDescription('Prueba visual (Obligatoria)').setRequired(true)),

    async execute(interaction) {
        if (!interaction.member.roles.cache.some(role => staffHierarchy.includes(role.id))) {
            return interaction.reply({ content: '❌ No tienes permisos.', ephemeral: true });
        }

        const user = interaction.options.getUser('usuario');
        const member = interaction.options.getMember('usuario');
        const motivo = interaction.options.getString('motivo');
        const evidencia = interaction.options.getAttachment('evidencia');

        await interaction.deferReply({ ephemeral: true });
        const imgbbLink = await uploadToImgBB(evidencia);
        
        const warnsSnap = await db.collection('sanciones_warns').where('usuarioId', '==', user.id).get();
        const numWarn = warnsSnap.size + 1;

        const docRef = await db.collection('sanciones_warns').add({
            usuarioId: user.id, usuarioTag: user.tag, moderadorId: interaction.user.id,
            motivo, evidencia: imgbbLink, fecha: new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }), tipo: 'WARN'
        });

        const casoId = docRef.id.slice(-6).toUpperCase();
        let sancionExtra = "Ninguna";
        let timeoutMS = 0;

        if (member) {
            if (numWarn === 1) { timeoutMS = 300000; sancionExtra = "⏳ Timeout 5m"; }
            else if (numWarn === 2) { timeoutMS = 1200000; sancionExtra = "⏳ Timeout 20m"; }
            else if (numWarn === 3) { timeoutMS = 3600000; sancionExtra = "⏳ Timeout 1h"; }
            else if (numWarn === 4) sancionExtra = "📢 SOLICITAR KICK";
            else if (numWarn >= 5) sancionExtra = "🚨 SOLICITAR BAN";

            if (timeoutMS > 0 && member.moderatable) await member.timeout(timeoutMS, `Warn #${numWarn}`);
        }

        const embed = new EmbedBuilder()
            .setColor(numWarn >= 3 ? '#ff0000' : '#ff8c00')
            .setTitle(`⚠️ WARN - N°${numWarn}`)
            .addFields(
                { name: '🆔 CASO', value: `#${casoId}`, inline: true },
                { name: '👤 USUARIO', value: `${user}`, inline: true },
                { name: '⚖️ SANCIÓN', value: sancionExtra },
                { name: '📝 MOTIVO', value: motivo }
            )
            .setImage(imgbbLink).setTimestamp();

        const canal = interaction.guild.channels.cache.get(CANAL_SANCIONES);
        if (canal) await canal.send({ embeds: [embed] });

        await interaction.editReply(`✅ Registrado: #${casoId}`);
    }
};