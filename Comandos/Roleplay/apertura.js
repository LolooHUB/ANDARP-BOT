const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle 
} = require('discord.js');
const { db } = require('../Automatizaciones/firebase');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('apertura')
        .setDescription('🚀 Sistema de gestión de sesiones (Votaciones por reacciones).'),

    async execute(interaction) {
        // --- 🛡️ RESTRICCIÓN DE ROLES ---
        const rolesPermitidos = [
            '1476767461024989326', // STAFF IDs
            '1476767863636234487',
            '1476768334048661586',
            '1476768951034970253'
        ];

        const tienePermiso = interaction.member.roles.cache.some(role => rolesPermitidos.includes(role.id));
        if (!tienePermiso) {
            return interaction.reply({
                content: '❌ No tienes los permisos necesarios para gestionar la apertura del servidor.',
                ephemeral: true
            });
        }

        try {
            const docRef = db.collection('server_state').doc('current');
            const stateDoc = await docRef.get();
            const data = stateDoc.exists ? stateDoc.data() : { open: false, voting: false };

            // 1️⃣ SI HAY UNA VOTACIÓN ACTIVA: Opción de cancelar
            if (data.voting) {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('confirm_cancel_vote').setLabel('Cancelar Votación').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('abort_action').setLabel('Mantener').setStyle(ButtonStyle.Secondary)
                );
                return interaction.reply({
                    content: '⚠️ **Hay una votación en curso.** ¿Deseas cancelarla?',
                    components: [row],
                    ephemeral: true
                });
            }

            // 2️⃣ SI EL SERVIDOR YA ESTÁ ABIERTO: Opción de cerrar
            if (data.open) {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('confirm_open_modal_cierre').setLabel('Cerrar Sesión').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('abort_action').setLabel('Mantener Abierta').setStyle(ButtonStyle.Secondary)
                );
                return interaction.reply({
                    content: '🛑 **El servidor está abierto.** ¿Deseas finalizar la sesión actual?',
                    components: [row],
                    ephemeral: true
                });
            }

            // 3️⃣ SI NO HAY NADA ACTIVO: Iniciar Setup de Nueva Sesión
            const modal = new ModalBuilder().setCustomId('modal_setup_rol').setTitle('Configurar Nueva Sesión');
            
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('hora_rol')
                        .setLabel("⏰ ¿A qué hora empieza el rol?")
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder("Ej: 22:30 ESP / 18:30 ARG")
                        .setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('min_gente')
                        .setLabel("👥 Mínimo de votos ✅ para abrir")
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder("Solo números (Ej: 12)")
                        .setMaxLength(2)
                        .setRequired(true)
                )
            );

            return await interaction.showModal(modal);

        } catch (error) {
            console.error("Error en Execute Apertura:", error);
            return interaction.reply({ content: "❌ Error al leer la base de datos.", ephemeral: true });
        }
    },

    // --- MANEJO DE INTERACCIONES (Botones y Modales) ---
    async handleAperturaInteractions(interaction) {
        const { customId, fields, guild, user } = interaction;
        const canalSesiones = guild.channels.cache.get('1489830006979956787');
        const canalLogs = guild.channels.cache.get('1482565635715109015');
        const docRef = db.collection('server_state').doc('current');

        if (customId === 'abort_action') {
            return interaction.update({ content: '✅ Acción cancelada.', components: [], ephemeral: true });
        }

        // Cancelar votación
        if (customId === 'confirm_cancel_vote') {
            await docRef.update({ voting: false, messageId: null, current_votes: 0 });
            return interaction.update({ content: '🛑 **Votación cancelada con éxito.**', components: [], ephemeral: true });
        }

        // Abrir modal de cierre
        if (customId === 'confirm_open_modal_cierre') {
            const modalCierre = new ModalBuilder().setCustomId('modal_resumen_cierre').setTitle('Finalizar Sesión');
            modalCierre.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('resumen_final')
                        .setLabel("📝 Resumen de la sesión")
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true)
                )
            );
            return await interaction.showModal(modalCierre);
        }

        // Procesar Setup de Votación (Modal)
        if (customId === 'modal_setup_rol') {
            if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });
            
            const hora = fields.getTextInputValue('hora_rol');
            const minGente = parseInt(fields.getTextInputValue('min_gente'));

            if (isNaN(minGente)) return interaction.editReply({ content: "❌ Error: El mínimo debe ser un número." });

            const embedVotacion = new EmbedBuilder()
                .setAuthor({ name: "Anda RP | Gestión de Sesiones", iconURL: guild.iconURL() })
                .setTitle("📊 Votación de Disponibilidad")
                .setDescription(`Se ha propuesto una sesión de rol.\n\n**Información:**\n⏰ Hora: **${hora}**\n👥 Mínimo requerido: **${minGente} votos ✅**\n\n**¿Cómo votar?**\n✅ - Participaré\n🟨 - Tarde\n❌ - No asistir`)
                .setColor(0xF1C40F)
                .setFooter({ text: "Sistema de Reacciones Activo" });

            const payload = { content: "<@&1476765007344828590>", embeds: [embedVotacion] };
            if (fs.existsSync('./attachment/BannerVotacion.png')) {
                embedVotacion.setImage('attachment://BannerVotacion.png');
                payload.files = ['./attachment/BannerVotacion.png'];
            }

            const msg = await canalSesiones.send(payload);
            await msg.react('✅'); await msg.react('🟨'); await msg.react('❌');

            await docRef.set({
                open: false, voting: true, target_votes: minGente,
                messageId: msg.id, host: user.id, hora_propuesta: hora
            });

            return interaction.editReply({ content: "✅ Votación lanzada con éxito." });
        }

        // Procesar Cierre Final (Modal)
        if (customId === 'modal_resumen_cierre') {
            if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });
            
            const resumen = fields.getTextInputValue('resumen_final');
            const fechaCierre = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });

            await docRef.set({ open: false, voting: false, messageId: null, current_votes: 0 });

            const embedLog = new EmbedBuilder()
                .setTitle("🛑 Sesión Finalizada")
                .addFields(
                    { name: "👤 Host", value: `<@${user.id}>`, inline: true },
                    { name: "📅 Fecha", value: fechaCierre, inline: true },
                    { name: "📝 Resumen", value: resumen }
                )
                .setColor(0xE74C3C);

            if (canalLogs) await canalLogs.send({ embeds: [embedLog] });

            const embedPublico = new EmbedBuilder().setTitle("🔴 Servidor Cerrado").setColor(0xE74C3C).setTimestamp();
            const payloadCierre = { content: "<@&1476765007344828590>", embeds: [embedPublico] };
            
            if (fs.existsSync('./attachment/BannerCierre.png')) {
                embedPublico.setImage('attachment://BannerCierre.png');
                payloadCierre.files = ['./attachment/BannerCierre.png'];
            }

            await canalSesiones.send(payloadCierre);
            return interaction.editReply({ content: "✅ Sesión cerrada correctamente." });
        }
    },

    // --- LÓGICA DE REACCIONES (Detección de votos) ---
    async handleReactions(reaction, user) {
        try {
            const docRef = db.collection('server_state').doc('current');
            const stateDoc = await docRef.get();
            if (!stateDoc.exists) return;

            const state = stateDoc.data();
            if (!state.voting || reaction.message.id !== state.messageId || reaction.emoji.name !== '✅') return;

            const votosActuales = reaction.count - 1; // Descontar al bot

            if (votosActuales >= state.target_votes) {
                await docRef.update({ open: true, voting: false, messageId: null });

                const embedAbierto = new EmbedBuilder()
                    .setTitle("🟢 ¡Servidor Abierto!")
                    .setDescription(`Hemos alcanzado los **${state.target_votes}** votos necesarios.\n\n**Código Servidor:** TwjxC\n👤 Host: <@${state.host}>\n\n¡Los esperamos dentro!`)
                    .setColor(0x2ECC71);

                const payloadOpen = { content: "<@&1476765007344828590>", embeds: [embedAbierto] };
                if (fs.existsSync('./attachment/BannerVotacionSI.png')) {
                    embedAbierto.setImage('attachment://BannerVotacionSI.png');
                    payloadOpen.files = ['./attachment/BannerVotacionSI.png'];
                }

                await reaction.message.channel.send(payloadOpen);

                // Notificar a los que votaron ✅
                const usuarios = await reaction.users.fetch();
                usuarios.forEach(async (u) => {
                    if (u.bot) return;
                    try {
                        const embedDM = new EmbedBuilder()
                            .setTitle("🚀 ¡El servidor ya está abierto!")
                            .setDescription(`¡Hola ${u.username}! Ya puedes entrar.\n\n**Código:** TwjxC`)
                            .setColor(0x2ECC71);
                        await u.send({ embeds: [embedDM] });
                    } catch (e) { /* DM Bloqueado */ }
                });
            }
        } catch (error) { console.error("Error handleReactions:", error); }
    }
};