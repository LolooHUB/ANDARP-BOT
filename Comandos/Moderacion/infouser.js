/**
 * 🔍 MÓDULO DE INTELIGENCIA - ANDA RP v4.0
 * ---------------------------------------------------------
 * SISTEMA DE PERFILADO DE CIUDADANOS Y STAFF
 * - Resumen de sanciones con medidor de peligrosidad.
 * - Historial detallado de Firebase.
 * - Integración con sistema de verificación.
 * ---------------------------------------------------------
 */

const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { db } = require('../Automatizaciones/firebase');

// --- 🎨 CONFIGURACIÓN VISUAL ---
const E_SIRENA = '🚨';
const E_ALERTA = '<:Problema1:1493237859384164362>';
const E_TICK = '<:TickVerde:1493314122958245938>';
const E_ID = '🆔';
const E_CALENDARIO = '📅';
const E_SHIELD = '🛡️';
const E_HISTORIAL = '📊';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('infouser')
        .setDescription('🔍 Perfil detallado: Sanciones, Verificación e Historial de Anda RP.')
        .addUserOption(opt => 
            opt.setName('usuario')
                .setDescription('Sujeto a investigar')
                .setRequired(true)),

    async execute(interaction) {
        // --- 🛡️ JERARQUÍA DE ACCESO ---
        const staffHierarchy = [
            '1476765837825277992', '1476766248242118697', '1476766796861149284',
            '1476767536530849822', '1476767750625038336', '1482153188856434828',
            '1476768019496829033', '1476768122915782676', '1476768405037125885',
            '1476768951034970253'
        ];

        if (!interaction.member.roles.cache.some(role => staffHierarchy.includes(role.id))) {
            return interaction.reply({ 
                content: `${E_ALERTA} **Acceso Denegado:** Tu rango no tiene acceso a los archivos de inteligencia.`, 
                ephemeral: true 
            });
        }

        const user = interaction.options.getUser('usuario');
        const member = interaction.options.getMember('usuario');
        const rolVerificadoId = '1476791384894865419';
        
        await interaction.deferReply();

        try {
            // 1. Consulta Multitarea en Firebase
            const [warnsSnap, kicksSnap, bansSnap, blacklistDoc] = await Promise.all([
                db.collection('sanciones_warns').where('usuarioId', '==', user.id).get(),
                db.collection('sanciones_kicks').where('usuarioId', '==', user.id).get(),
                db.collection('sanciones_bans').where('usuarioId', '==', user.id).get(),
                db.collection('blacklist').doc(user.id).get()
            ]);

            const tWarns = warnsSnap.size;
            const tKicks = kicksSnap.size;
            const tBans = bansSnap.size;
            const isBlack = blacklistDoc.exists;

            // 2. Lógica de Peligrosidad (Upgrade)
            let peligrosidad = "🟢 NIVEL: SEGURO";
            let color = "#2ecc71";
            const puntosPeligro = (tWarns * 1) + (tKicks * 2) + (tBans * 5) + (isBlack ? 10 : 0);

            if (puntosPeligro >= 1 && puntosPeligro <= 3) {
                peligrosidad = "🟡 NIVEL: PRECAUCIÓN";
                color = "#f1c40f";
            } else if (puntosPeligro > 3 && puntosPeligro <= 6) {
                peligrosidad = "🟠 NIVEL: SOSPECHOSO";
                color = "#e67e22";
            } else if (puntosPeligro > 6) {
                peligrosidad = "🔴 NIVEL: PELIGROSO / REINCIDENTE";
                color = "#c0392b";
            }

            // 3. Estado de Verificación
            const verifStatus = member && member.roles.cache.has(rolVerificadoId) 
                ? `${E_TICK} **VERIFICADO**` 
                : `${E_ALERTA} **NO VERIFICADO**`;

            // 4. Construcción de la Interfaz
            const embedInfo = new EmbedBuilder()
                .setColor(color)
                .setAuthor({ name: 'INTELIGENCIA DE USUARIOS • ANDA RP', iconURL: 'https://i.imgur.com/8L8O7vU.png' })
                .setTitle(`${user.tag}`)
                .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                .setDescription(
                    `Este informe detalla la actividad administrativa y el estado del ciudadano en el servidor.`
                )
                .addFields(
                    { name: `${E_ID} DATOS DE CUENTA`, value: `> **ID:** \`${user.id}\`\n> **Creada:** <t:${Math.floor(user.createdTimestamp / 1000)}:R>\n> **Ingreso:** ${member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : "No está en el server"}`, inline: false },
                    
                    { name: `${E_SHIELD} SEGURIDAD`, value: `> **Estado:** ${verifStatus}\n> **Peligrosidad:** \`${peligrosidad}\``, inline: false },

                    { name: `${E_HISTORIAL} HISTORIAL DE SANCIONES`, value: 
                        `\`\`\`yml\n` +
                        `ADVERTENCIAS (WARNS): ${tWarns}\n` +
                        `EXPULSIONES (KICKS):  ${tKicks}\n` +
                        `BANEOS (BANS):       ${tBans}\n` +
                        `VETADO (BLACKLIST):  ${isBlack ? 'SÍ' : 'NO'}\n` +
                        `\`\`\``, inline: false }
                )
                .setTimestamp()
                .setFooter({ text: 'Archivo confidencial - Uso exclusivo Staff', iconURL: 'https://i.imgur.com/vH8vL4S.png' });

            // 5. Detalles de Warns Recientes
            if (tWarns > 0) {
                const logs = warnsSnap.docs.slice(-3).reverse().map(doc => {
                    const d = doc.data();
                    const fecha = d.fecha ? `[${d.fecha.split(',')[0]}]` : '[S/F]';
                    return `\`${fecha}\` **${d.motivo.substring(0, 40)}...**`;
                }).join('\n');
                
                embedInfo.addFields({ name: '📑 ÚLTIMOS REPORTES', value: logs });
            }

            // 6. Enviar Respuesta
            return await interaction.editReply({ 
                embeds: [embedInfo],
                files: [new AttachmentBuilder('./attachment/LogoPFP.png')] 
            });

        } catch (error) {
            console.error("Error en InfoUser:", error);
            return interaction.editReply({ 
                content: `${E_ALERTA} No se pudo recuperar el expediente del usuario de la base de datos.` 
            });
        }
    }
};