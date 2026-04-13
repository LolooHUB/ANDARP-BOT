/**
 * 👮 MÓDULO POLICIAL - ANDA RP v3.2
 * ---------------------------------------------------------
 * SISTEMA CENTRAL DE ANTECEDENTES Y ARCHIVO JUDICIAL
 * - Verificación de rango y autorización.
 * - Cálculo dinámico de peligrosidad.
 * - Historial detallado con evidencias y multas.
 * ---------------------------------------------------------
 */

const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} = require('discord.js');
const { db } = require('../Automatizaciones/firebase');

// --- 🎨 DEFINICIÓN DE EMOJIS ---
const E_EURO = '<:Euro:1493238471555289208>';
const E_ALERTA = '<:Problema1:1493237859384164362>';
const E_DNI = '<:Aprobado1:1493237545486516224>';
const E_POLI = '👮';
const E_ESCUDO = '🛡️';
const E_SIRENA = '🚨';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('antecedentes')
        .setDescription('👮 Consultar el historial delictivo de un ciudadano (Uso Policial).')
        .addUserOption(option => 
            option.setName('usuario')
                .setDescription('Sujeto a investigar.')
                .setRequired(true)),

    async execute(interaction) {
        // --- 🛡️ CONFIGURACIÓN DE SEGURIDAD ---
        const ID_ROL_POLICIA = '1490138479567306864';
        const canalLogsPolicia = 'TU_ID_CANAL_LOGS_PD';

        // 1. Verificación de Autorización
        if (!interaction.member.roles.cache.has(ID_ROL_POLICIA)) {
            return interaction.reply({ 
                content: `${E_ALERTA} **Acceso Denegado:** Se requiere autorización del **Ministerio del Interior**. Su intento de acceso ha sido registrado.`, 
                ephemeral: true 
            });
        }

        const target = interaction.options.getUser('usuario');

        try {
            // 2. Consulta a Firebase
            const userRef = db.collection('usuarios_rp').doc(target.id);
            const doc = await userRef.get();

            if (!doc.exists) {
                return interaction.reply({ 
                    content: `${E_ALERTA} El sujeto ${target} no figura en la base de datos del Registro Civil ${E_DNI}.`, 
                    ephemeral: true 
                });
            }

            const data = doc.data();
            const historial = data.historial_delictivo || [];
            
            // 3. Lógica de Peligrosidad
            let colorEmbed = 0x27AE60; // Verde (Limpio)
            let estadoSujeto = "✅ SIN REGISTROS";
            
            if (historial.length > 0 && historial.length < 5) {
                colorEmbed = 0xF1C40F; // Amarillo (Precaución)
                estadoSujeto = "⚠️ BAJA PELIGROSIDAD";
            } else if (historial.length >= 5) {
                colorEmbed = 0xC0392B; // Rojo (Peligro)
                estadoSujeto = "🚨 ALTA PELIGROSIDAD / REINCIDENTE";
            }

            // 4. Construcción del Expediente
            const embedExpediente = new EmbedBuilder()
                .setAuthor({ 
                    name: 'INTELIGENCIA POLICIAL • ARCHIVO CENTRAL', 
                    iconURL: 'https://i.imgur.com/8L8O7vU.png' 
                })
                .setTitle(`${E_ESCUDO} EXPEDIENTE JUDICIAL: ${data.nombre.toUpperCase()}`)
                .setDescription(
                    `Información confidencial del Ministerio del Interior.\n` +
                    `**DNI:** \`#${data.numero_dni}\` | **ID Discord:** \`${target.id}\``
                )
                .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                .setColor(colorEmbed)
                .addFields(
                    { name: '📊 Estado del Sujeto', value: `\`${estadoSujeto}\``, inline: true },
                    { name: '📁 Total Registros', value: `\`${historial.length} delitos\``, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: `Consulta realizada por: ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() });

            // 5. Mapeo de Historial (Máximo 8 para legibilidad)
            if (historial.length === 0) {
                embedExpediente.addFields({ 
                    name: '🔍 Historial Penales', 
                    value: 'No se han encontrado cargos criminales vigentes para este ciudadano.' 
                });
            } else {
                const listaCargos = historial.slice(-8).reverse().map((delito, index) => {
                    const cuantiaTexto = delito.cuantia ? `\n> **Multa:** \`${delito.cuantia.toLocaleString()}€\` ${E_EURO}` : '';
                    const evidenciaTexto = (delito.evidencia && delito.evidencia.startsWith('http')) ? `\n> **Evidencia:** [Clic para Ver](${delito.evidencia})` : '';
                    
                    return `**${index + 1}. ${delito.tipo || 'DELITO'}**\n> **Motivo:** ${delito.motivo}\n> **Fecha:** \`${delito.fecha}\`\n> **Agente:** <@${delito.agente_id || delito.agente}>${cuantiaTexto}${evidenciaTexto}`;
                }).join('\n\n');

                embedExpediente.addFields({ name: `${E_SIRENA} Últimos Registros`, value: listaCargos });
                
                if (historial.length > 8) {
                    embedExpediente.addFields({ 
                        name: '...', 
                        value: `*Hay ${historial.length - 8} registros adicionales en el archivo.*` 
                    });
                }
            }

            // 6. Botones de Acción Rápida (Estéticos para Staff)
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('Emitir Orden de Arresto')
                    .setCustomId('orden_arresto')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('⚖️'),
                new ButtonBuilder()
                    .setLabel('Limpiar Historial')
                    .setCustomId('clear_history')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🧹')
            );

            // 7. Log de Consulta (Transparencia Administrativa)
            const canalLog = interaction.guild.channels.cache.get(canalLogsPolicia);
            if (canalLog) {
                canalLog.send({
                    content: `🔍 **LOG DE CONSULTA:** <@${interaction.user.id}> ha consultado los antecedentes de ${target} (#${data.numero_dni}).`
                });
            }

            // 8. Respuesta Final (Ephemereal para cumplir protocolos IC)
            return await interaction.reply({ 
                embeds: [embedExpediente], 
                components: [row],
                ephemeral: true 
            });

        } catch (error) {
            console.error("❌ Error en Antecedentes:", error);
            return interaction.reply({ 
                content: `${E_ALERTA} Error crítico al conectar con el servidor central del Ministerio.`, 
                ephemeral: true 
            });
        }
    }
};