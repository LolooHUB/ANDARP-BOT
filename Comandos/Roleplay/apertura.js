const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle,
    PermissionFlagsBits 
} = require('discord.js');
const { db } = require('../Automatizaciones/firebase');
const fs = require('fs');
const path = require('path');

// --- ⚙️ CONFIGURACIÓN DE CANALES Y CONSTANTES ---
const CANAL_ESTADO_ID = '1493197563934019685';
const CANAL_CODIGO_ID = '1493197387081191434';
const CANAL_SESIONES_ID = '1489830006979956787';
const CANAL_LOGS_ID = '1482565635715109015';
const CODIGO_SERVER = 'TwjxC';

// --- 🎨 EMOJIS PERSONALIZADOS ---
const EMOJI_RELOJ = '<:Reloj:1493238390336917637>';
const EMOJI_ABIERTO = '<:Abierto2:1493238594259779604>';
const EMOJI_CERRADO = '<:Cerrado2:1493238535270957116>';

// --- 🛡️ ROLES DE STAFF AUTORIZADOS ---
const ROLES_STAFF = [
    '1476767461024989326',
    '1476767863636234487',
    '1476768334048661586',
    '1476768951034970253'
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('apertura')
        .setDescription('🚀 Sistema integral de gestión de sesiones y control de canales de estado.'),

    /**
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const { member, guild } = interaction;

        const tienePermiso = member.roles.cache.some(role => ROLES_STAFF.includes(role.id));
        if (!tienePermiso) {
            return interaction.reply({
                content: '❌ No cuentas con la jerarquía necesaria para ejecutar este comando.',
                ephemeral: true
            });
        }

        try {
            const docRef = db.collection('server_state').doc('current');
            const stateDoc = await docRef.get();
            const data = stateDoc.exists ? stateDoc.data() : { open: false, voting: false };

            if (data.voting) {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('confirm_cancel_vote').setLabel('Cancelar Votación').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('abort_action').setLabel('Volver').setStyle(ButtonStyle.Secondary)
                );
                return interaction.reply({
                    content: `${EMOJI_RELOJ} **Alerta:** Existe una votación activa. ¿Deseas interrumpirla?`,
                    components: [row],
                    ephemeral: true
                });
            }

            if (data.open) {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('confirm_open_modal_cierre').setLabel('Cerrar Servidor').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('abort_action').setLabel('Mantener Abierto').setStyle(ButtonStyle.Secondary)
                );
                return interaction.reply({
                    content: `${EMOJI_ABIERTO} **Aviso:** El servidor ya está **ABIERTO**. ¿Proceder al cierre?`,
                    components: [row],
                    ephemeral: true
                });
            }

            const modal = new ModalBuilder().setCustomId('modal_setup_rol').setTitle('Configuración de Sesión');
            
            const inputHora = new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('hora_rol')
                    .setLabel("⏰ Hora de Inicio")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("Ej: 22:30 ESP / 18:30 ARG")
                    .setRequired(true)
            );

            const inputVotos = new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('min_gente')
                    .setLabel("👥 Mínimo de Votos Positivos")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("Cantidad necesaria (Ej: 10)")
                    .setMaxLength(2)
                    .setRequired(true)
            );

            modal.addComponents(inputHora, inputVotos);
            await interaction.showModal(modal);

        } catch (error) {
            console.error("Error en Apertura Execute:", error);
            if (!interaction.replied) {
                return interaction.reply({ content: "❌ Error crítico con la base de datos.", ephemeral: true });
            }
        }
    },

    /**
     * @param {import('discord.js').Interaction} interaction 
     */
    async handleAperturaInteractions(interaction) {
        const { customId, fields, guild, user } = interaction;
        const docRef = db.collection('server_state').doc('current');
        
        const canalEstado = guild.channels.cache.get(CANAL_ESTADO_ID);
        const canalCodigo = guild.channels.cache.get(CANAL_CODIGO_ID);
        const canalSesiones = guild.channels.cache.get(CANAL_SESIONES_ID);
        const canalLogs = guild.channels.cache.get(CANAL_LOGS_ID);

        if (customId === 'abort_action') {
            return interaction.update({ content: '✅ Operación cancelada.', components: [], ephemeral: true });
        }

        if (customId === 'confirm_cancel_vote') {
            await docRef.update({ voting: false, messageId: null, current_votes: 0 });
            
            if (canalEstado) await canalEstado.setName(`〔🚦〕Estado : ${EMOJI_CERRADO.split(':')[1]}`).catch(() => canalEstado.setName('〔🚦〕Estado : ❌'));
            if (canalCodigo) {
                await canalCodigo.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false }).catch(console.error);
            }

            return interaction.update({ content: `${EMOJI_CERRADO} **Votación anulada.** Canales restablecidos.`, components: [], ephemeral: true });
        }

        if (customId === 'confirm_open_modal_cierre') {
            const modalCierre = new ModalBuilder().setCustomId('modal_resumen_cierre').setTitle('Resumen de Finalización');
            const inputResumen = new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('resumen_final')
                    .setLabel("📝 Resumen de la sesión")
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
            );
            modalCierre.addComponents(inputResumen);
            return await interaction.showModal(modalCierre);
        }

        if (customId === 'modal_setup_rol') {
            if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });

            const hora = fields.getTextInputValue('hora_rol');
            const minGente = parseInt(fields.getTextInputValue('min_gente'));

            if (isNaN(minGente)) return interaction.editReply({ content: "❌ Formato de votos inválido." });

            const embedVotacion = new EmbedBuilder()
                .setAuthor({ name: "Anda RP | Sistema de Sesiones", iconURL: guild.iconURL() })
                .setTitle(`${EMOJI_RELOJ} Convocatoria de Disponibilidad`)
                .setDescription(`Se ha propuesto una nueva sesión de rol.\n\n**Detalles:**\n⏰ Hora: **${hora}**\n👥 Requisito: **${minGente} votos ✅**\n\nReacciona para participar.`)
                .setColor(0xF1C40F)
                .setFooter({ text: "Apertura automática al llegar a la meta." });

            const msg = await canalSesiones.send({ content: "<@&1476765007344828590>", embeds: [embedVotacion] });
            await msg.react('✅'); await msg.react('🟨'); await msg.react('❌');

            await docRef.set({
                open: false,
                voting: true,
                target_votes: minGente,
                messageId: msg.id,
                host: user.id,
                hora_propuesta: hora
            });

            if (canalEstado) await canalEstado.setName(`〔🚦〕Estado : 🔰 Espera`).catch(console.error);
            if (canalCodigo) {
                await canalCodigo.setName('〔🔐〕Codigo : Oculto').catch(console.error);
                await canalCodigo.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false }).catch(console.error);
            }

            return interaction.editReply({ content: `${EMOJI_RELOJ} Votación publicada con éxito.` });
        }

        if (customId === 'modal_resumen_cierre') {
            if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });

            const resumen = fields.getTextInputValue('resumen_final');
            const ahora = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });

            await docRef.set({ open: false, voting: false, messageId: null, current_votes: 0 });

            if (canalEstado) await canalEstado.setName(`〔🚦〕Estado : Cerrado`).catch(console.error);
            if (canalCodigo) {
                await canalCodigo.setName('〔🔐〕Codigo : Oculto').catch(console.error);
                await canalCodigo.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false }).catch(console.error);
            }

            const embedLog = new EmbedBuilder()
                .setTitle(`${EMOJI_CERRADO} Log: Sesión Finalizada`)
                .addFields(
                    { name: "👤 Responsable", value: `<@${user.id}>`, inline: true },
                    { name: "📅 Fecha", value: ahora, inline: true },
                    { name: "📝 Resumen", value: resumen }
                )
                .setColor(0xE74C3C);

            if (canalLogs) await canalLogs.send({ embeds: [embedLog] });

            const embedPublico = new EmbedBuilder()
                .setTitle(`${EMOJI_CERRADO} Servidor Cerrado`)
                .setDescription("La sesión ha finalizado. ¡Gracias por participar!")
                .setColor(0xE74C3C);

            await canalSesiones.send({ content: "<@&1476765007344828590>", embeds: [embedPublico] });

            return interaction.editReply({ content: "✅ Servidor cerrado correctamente." });
        }
    },

    async handleReactions(reaction, user) {
        if (user.bot) return;

        try {
            const docRef = db.collection('server_state').doc('current');
            const stateDoc = await docRef.get();
            if (!stateDoc.exists) return;

            const state = stateDoc.data();
            if (!state.voting || reaction.message.id !== state.messageId || reaction.emoji.name !== '✅') return;

            const votosActuales = reaction.count - 1;

            if (votosActuales >= state.target_votes) {
                await docRef.update({ open: true, voting: false, messageId: null });

                const guild = reaction.message.guild;
                const canalEstado = guild.channels.cache.get(CANAL_ESTADO_ID);
                const canalCodigo = guild.channels.cache.get(CANAL_CODIGO_ID);

                if (canalEstado) await canalEstado.setName(`〔🚦〕Estado : Abierto`).catch(console.error);
                if (canalCodigo) {
                    await canalCodigo.setName(`〔🔐〕Codigo : ${CODIGO_SERVER}`).catch(console.error);
                    await canalCodigo.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: true }).catch(console.error);
                }

                const embedAbierto = new EmbedBuilder()
                    .setTitle(`${EMOJI_ABIERTO} ¡SERVIDOR ABIERTO!`)
                    .setDescription(`Se ha alcanzado la meta de **${state.target_votes}** votos.\n\n**Acceso:**\n🔑 Código: \`${CODIGO_SERVER}\`\n👤 Host: <@${state.host}>`)
                    .setColor(0x2ECC71)
                    .setThumbnail(guild.iconURL());

                await reaction.message.channel.send({ content: "<@&1476765007344828590>", embeds: [embedAbierto] });

                const usuarios = await reaction.users.fetch();
                for (const [id, u] of usuarios) {
                    if (u.bot) continue;
                    try {
                        const embedDM = new EmbedBuilder()
                            .setTitle(`${EMOJI_ABIERTO} ¡Ya puedes entrar!`)
                            .setDescription(`El servidor de **Anda RP** está activo.\n🔑 Código: \`${CODIGO_SERVER}\``)
                            .setColor(0x2ECC71);
                        await u.send({ embeds: [embedDM] });
                    } catch (e) {}
                }
            }
        } catch (error) {
            console.error("Error en handleReactions:", error);
        }
    }
};