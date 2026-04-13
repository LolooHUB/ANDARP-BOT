const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const { db } = require('../Automatizaciones/firebase');
const axios = require('axios');
const FormData = require('form-data');

// --- CONSTANTES DE CONFIGURACIÓN ---
const CANAL_SANCIONES = '1477387624288354324';
const CANAL_LOGS_RETIRO = '1482565635715109015';
const RUTA_LOGO = './attachment/LogoPFP.png';

const staffHierarchy = [
    '1476766248242118697', '1476766796861149284', '1476767536530849822',
    '1476767750625038336', '1482153188856434828', '1476768019496829033',
    '1476768122915782676', '1476768405037125885', '1476768951034970253'
];

// --- UTILIDADES ---
async function uploadToImgBB(attachment) {
    if (!attachment) return null;
    try {
        const formData = new FormData();
        formData.append('image', attachment.url);
        const apiKey = process.env.APIKEY_IMGBB; 
        const response = await axios.post(`https://api.imgbb.com/1/upload?key=${apiKey}`, formData);
        return response.data.data.url; 
    } catch (error) {
        console.error("Error ImgBB:", error.message);
        return attachment.url; 
    }
}

module.exports = [
    {
        // --- COMANDO WARN ---
        data: new SlashCommandBuilder()
            .setName('warn')
            .setDescription('⚠️ Aplica una advertencia formal a un usuario.')
            .addUserOption(opt => opt.setName('usuario').setDescription('Usuario a sancionar').setRequired(true))
            .addStringOption(opt => opt.setName('motivo').setDescription('Motivo detallado').setRequired(true))
            .addAttachmentOption(opt => opt.setName('evidencia').setDescription('Prueba visual (Obligatoria)').setRequired(true)),

        async execute(interaction) {
            if (!interaction.member.roles.cache.some(role => staffHierarchy.includes(role.id))) {
                return interaction.reply({ content: '❌ No tienes permisos de Staff para usar este comando.', ephemeral: true });
            }

            const user = interaction.options.getUser('usuario');
            const member = interaction.options.getMember('usuario');
            const motivo = interaction.options.getString('motivo');
            const evidencia = interaction.options.getAttachment('evidencia');

            await interaction.deferReply({ ephemeral: true });

            const imgbbLink = await uploadToImgBB(evidencia);
            
            // Obtener número de warns actuales
            const warnsSnap = await db.collection('sanciones_warns').where('usuarioId', '==', user.id).get();
            const numWarn = warnsSnap.size + 1;

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

            // Lógica de Sanciones Automáticas
            let sancionExtra = "Ninguna";
            let timeoutMS = 0;
            if (member) {
                if (numWarn === 1) { timeoutMS = 5 * 60 * 1000; sancionExtra = "⏳ Timeout 5m"; }
                else if (numWarn === 2) { timeoutMS = 20 * 60 * 1000; sancionExtra = "⏳ Timeout 20m"; }
                else if (numWarn === 3) { timeoutMS = 60 * 60 * 1000; sancionExtra = "⏳ Timeout 1h"; }
                else if (numWarn === 4) { sancionExtra = "📢 SOLICITAR KICK"; }
                else if (numWarn >= 5) { sancionExtra = "🚨 SOLICITAR BAN PERMANENTE"; }
                
                if (timeoutMS > 0 && member.moderatable) {
                    await member.timeout(timeoutMS, `Warn #${numWarn} | Caso: ${casoId}`);
                }
            }

            const embedWarn = new EmbedBuilder()
                .setColor(numWarn >= 3 ? '#ff0000' : '#ff8c00')
                .setTitle(`⚠️ WARN REGISTRADO - N°${numWarn}`)
                .setThumbnail(user.displayAvatarURL())
                .addFields(
                    { name: '🆔 ID DE CASO', value: `\`#${casoId}\``, inline: true },
                    { name: '👤 USUARIO', value: `${user} (\`${user.id}\`)`, inline: true },
                    { name: '👮 MODERADOR', value: `${interaction.user}`, inline: true },
                    { name: '⚖️ SANCIÓN APLICADA', value: `\`${sancionExtra}\``, inline: false },
                    { name: '📝 MOTIVO', value: motivo, inline: false }
                )
                .setImage(imgbbLink)
                .setFooter({ text: 'Anda RP • Sistema de Disciplina' })
                .setTimestamp();

            const canalSanciones = interaction.guild.channels.cache.get(CANAL_SANCIONES);
            if (canalSanciones) {
                await canalSanciones.send({ 
                    content: numWarn >= 4 ? `🚨 @everyone **ALERTA CRÍTICA:** ${user} ha alcanzado su warn N°${numWarn}` : null,
                    embeds: [embedWarn]
                });
            }

            try { 
                await user.send({ content: `⚠️ **HAS SIDO SANCIONADO EN ANDA RP**\nHas recibido tu advertencia número **${numWarn}**.\n\n**ID de Caso:** #${casoId}\n**Motivo:** ${motivo}\n**Sanción:** ${sancionExtra}` }); 
            } catch (e) { console.log("No pude enviar DM al usuario."); }

            await interaction.editReply({ content: `✅ Warn registrado con éxito. **Caso: #${casoId}**.` });
        }
    },
    {
        // --- COMANDO CLEARWARN ---
        data: new SlashCommandBuilder()
            .setName('clearwarn')
            .setDescription('🗑️ Retira un warn del sistema.')
            .addStringOption(opt => opt.setName('casoid').setDescription('ID del caso (ej: A1B2C3)').setRequired(true))
            .addStringOption(opt => opt.setName('motivo').setDescription('Motivo de la retirada').setRequired(true)),

        async execute(interaction) {
            const adminHierarchy = ['1476767750625038336', '1476768019496829033', '1476768122915782676', '1476768405037125885', '1476768951034970253'];
            
            if (!interaction.member.roles.cache.some(role => adminHierarchy.includes(role.id))) {
                return interaction.reply({ content: '❌ Solo Administradores pueden retirar sanciones.', ephemeral: true });
            }

            const casoIdInput = interaction.options.getString('casoid').toUpperCase();
            const motivoRemocion = interaction.options.getString('motivo');

            await interaction.deferReply({ ephemeral: true });

            const query = await db.collection('sanciones_warns').get();
            const docBorrar = query.docs.find(doc => doc.id.slice(-6).toUpperCase() === casoIdInput);

            if (!docBorrar) {
                return interaction.editReply({ content: `❌ No existe el caso **#${casoIdInput}** en la base de datos.` });
            }

            const dataWarn = docBorrar.data();
            await docBorrar.ref.delete();

            const embedClear = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle(`🗑️ WARN RETIRADO - #${casoIdInput}`)
                .setDescription(`Se ha eliminado una sanción del historial de <@${dataWarn.usuarioId}>.`)
                .addFields(
                    { name: '👮 ADMIN', value: `${interaction.user}`, inline: true },
                    { name: '📝 MOTIVO DE RETIRADA', value: motivoRemocion, inline: true }
                )
                .setTimestamp();

            const canalLogs = interaction.guild.channels.cache.get(CANAL_LOGS_RETIRO);
            if (canalLogs) {
                await canalLogs.send({ embeds: [embedClear] });
            }

            await interaction.editReply({ content: `✅ Sanción **#${casoIdInput}** eliminada del sistema.` });
        }
    }
];