const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../Automatizaciones/firebase');
const axios = require('axios');
const FormData = require('form-data');

// --- UTILIDADES ---
async function uploadToImgBB(attachment) {
    if (!attachment) return null;
    try {
        const formData = new FormData();
        formData.append('image', attachment.url);
        const apiKey = process.env.APIKEY_IMGBB; 
        const response = await axios.post(`https://api.imgbb.com/1/upload?key=${apiKey}`, formData, {
            headers: { ...formData.getHeaders() }
        });
        return response.data.data.url; 
    } catch (error) {
        return attachment.url; 
    }
}

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

// --- COMANDOS ---
module.exports = [
    {
        // COMANDO WARN
        data: new SlashCommandBuilder()
            .setName('warn')
            .setDescription('⚠️ Aplica un warn a un usuario.')
            .addUserOption(opt => opt.setName('usuario').setDescription('Usuario a sancionar').setRequired(true))
            .addStringOption(opt => opt.setName('motivo').setDescription('Motivo de la sanción').setRequired(true))
            .addAttachmentOption(opt => opt.setName('evidencia').setDescription('Prueba visual').setRequired(true)),

        async execute(interaction) {
            if (!interaction.member.roles.cache.some(role => staffHierarchy.includes(role.id))) {
                return interaction.reply({ content: '❌ No tienes permisos de Staff.', ephemeral: true });
            }

            const user = interaction.options.getUser('usuario');
            const member = interaction.options.getMember('usuario');
            const motivo = interaction.options.getString('motivo');
            const evidencia = interaction.options.getAttachment('evidencia');

            await interaction.deferReply({ ephemeral: true });

            const imgbbLink = await uploadToImgBB(evidencia);
            const warnsSnap = await db.collection('sanciones_warns').where('usuarioId', '==', user.id).get();
            const numWarn = warnsSnap.size + 1;

            // Guardar en Firebase y generar Caso ID
            const docRef = await db.collection('sanciones_warns').add({
                usuarioId: user.id,
                usuarioTag: user.tag,
                moderadorId: interaction.user.id,
                motivo: motivo,
                evidencia: imgbbLink,
                fecha: new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }),
                tipo: 'WARN'
            });
            const casoId = docRef.id.slice(-6).toUpperCase();

            // Lógica de Sanciones
            let sancionExtra = "Ninguna";
            let timeoutMS = 0;
            if (member) {
                if (numWarn === 1) { timeoutMS = 5 * 60 * 1000; sancionExtra = "Timeout 5 Minutos"; }
                else if (numWarn === 2) { timeoutMS = 20 * 60 * 1000; sancionExtra = "Timeout 20 Minutos"; }
                else if (numWarn === 3) { timeoutMS = 60 * 60 * 1000; sancionExtra = "Timeout 1 Hora"; }
                else if (numWarn === 4) { sancionExtra = "📢 SOLICITAR KICK"; }
                else if (numWarn >= 5) { sancionExtra = "🚨 SOLICITAR BAN"; }
                if (timeoutMS > 0) await member.timeout(timeoutMS, `Warn N°${numWarn}: ${motivo}`);
            }

            const embedWarn = new EmbedBuilder()
                .setColor('#ff8c00')
                .setTitle(`⚠️ Warn N°${numWarn} - Caso: #${casoId}`)
                .addFields(
                    { name: '👤 **USUARIO**', value: `<@${user.id}>`, inline: true },
                    { name: '👮 **MODERADOR**', value: `<@${interaction.user.id}>`, inline: true },
                    { name: '⚖️ **SANCIÓN**', value: sancionExtra, inline: false },
                    { name: '📝 **MOTIVO**', value: motivo, inline: false }
                )
                .setAuthor({ name: "Anda RP", iconURL: "attachment://LogoPFP.png" })
                .setFooter({ text: 'Anda RP - Rol de calidad', iconURL: "attachment://LogoPFP.png" })
                .setTimestamp();

            const canalSanciones = interaction.guild.channels.cache.get('1477387624288354324');
            if (canalSanciones) {
                await canalSanciones.send({ 
                    content: numWarn >= 4 ? `🚨 **ALERTA STAFF:** <@${user.id}> Warn N°${numWarn}` : `🔗 **Evidencia:** ${imgbbLink}`,
                    embeds: [embedWarn], 
                    files: ['./attachment/LogoPFP.png'] 
                });
            }

            try { await user.send(`⚠️ **Recibiste un Warn N°${numWarn}**\n**Caso:** #${casoId}\n**Motivo:** ${motivo}\n**Evidencia:** ${imgbbLink}`); } catch (e) {}
            await interaction.editReply({ content: `✅ Registrado como Caso **#${casoId}**.` });
        }
    },
    {
        // COMANDO CLEARWARN
        data: new SlashCommandBuilder()
            .setName('clearwarn')
            .setDescription('🗑️ Elimina un warn específico mediante su ID de Caso.')
            .addStringOption(opt => opt.setName('casoid').setDescription('ID del caso (ej: A1B2C3)').setRequired(true))
            .addStringOption(opt => opt.setName('motivo').setDescription('Motivo de la eliminación').setRequired(true))
            .addAttachmentOption(opt => opt.setName('evidencia').setDescription('Evidencia opcional').setRequired(false)),

        async execute(interaction) {
            // Solo Administradores en adelante pueden borrar
            const adminHierarchy = ['1476767750625038336', '1476768019496829033', '1476768122915782676', '1476768405037125885', '1476768951034970253'];
            if (!interaction.member.roles.cache.some(role => adminHierarchy.includes(role.id))) {
                return interaction.reply({ content: '❌ Solo un Administrador o superior puede retirar warns.', ephemeral: true });
            }

            const casoIdInput = interaction.options.getString('casoid').toUpperCase();
            const motivoRemocion = interaction.options.getString('motivo');
            const evidencia = interaction.options.getAttachment('evidencia');

            await interaction.deferReply({ ephemeral: true });

            const warnsSnap = await db.collection('sanciones_warns').get();
            const docBorrar = warnsSnap.docs.find(doc => doc.id.slice(-6).toUpperCase() === casoIdInput);

            if (!docBorrar) return interaction.editReply({ content: `❌ No encontré ningún caso con la ID **#${casoIdInput}**.` });

            const dataWarn = docBorrar.data();
            const imgbbLinkRem = await uploadToImgBB(evidencia);

            await docBorrar.ref.delete();

            const embedClear = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle(`🗑️ Warn Retirado - Caso: #${casoIdInput}`)
                .setDescription(`El warn aplicado a <@${dataWarn.usuarioId}> ha sido eliminado del sistema.`)
                .addFields(
                    { name: '👮 **MODERADOR QUE RETIRA**', value: `<@${interaction.user.id}>`, inline: true },
                    { name: '📝 **MOTIVO DE RETIRADA**', value: motivoRemocion, inline: true }
                )
                .setAuthor({ name: "Anda RP", iconURL: "attachment://LogoPFP.png" })
                .setFooter({ text: 'Anda RP - Rol de calidad', iconURL: "attachment://LogoPFP.png" })
                .setTimestamp();

            const canalLogs = interaction.guild.channels.cache.get('1482565635715109015');
            if (canalLogs) {
                await canalLogs.send({ 
                    content: imgbbLinkRem ? `🔗 **Evidencia de remoción:** ${imgbbLinkRem}` : null,
                    embeds: [embedClear], 
                    files: ['./attachment/LogoPFP.png'] 
                });
            }

            await interaction.editReply({ content: `✅ El caso **#${casoIdInput}** ha sido eliminado correctamente.` });
        }
    }
];