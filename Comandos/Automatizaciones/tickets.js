const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelType, 
    PermissionFlagsBits, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle,
    Collection,
    AttachmentBuilder
} = require('discord.js');
const { db, getNextTicketId } = require('./firebase');
const transcripts = require('discord-html-transcripts');

/**
 * 🎫 SISTEMA DE TICKETS ELITE - ANDA RP
 * Versión: 3.5.0 (Producción)
 * * Este archivo gestiona:
 * - Creación dinámica de canales por categorías.
 * - Validación de jerarquía de Staff (10 niveles).
 * - Derivación a departamentos específicos (Compras).
 * - Logs detallados con estadísticas de participación.
 * - Transcripción profesional en HTML.
 */

module.exports = {
    // --- 1. GENERACIÓN DEL PANEL DE BIENVENIDA ---
    async sendTicketPanel(channel) {
        try {
            console.log("🛠️ [TICKETS] Generando panel de soporte...");

            const mainEmbed = new EmbedBuilder()
                .setColor('#e1ff00')
                .setTitle('✨ Centro de Soporte Ciudadano - Anda RP')
                .setAuthor({ 
                    name: 'Soporte Anda RP', 
                    iconURL: 'attachment://LogoPFP.png' 
                })
                .setDescription(
                    'Bienvenido al sistema de atención automatizada. Por favor, selecciona la categoría que mejor se adapte a tu consulta para ser asignado al personal correcto.\n\n' +
                    '📡 **Soporte General:**\n' +
                    '> Consultas sobre el servidor, reportes de errores leves o dudas mecánicas.\n\n' +
                    '🚫 **Centro de Reportes:**\n' +
                    '> Denuncias contra jugadores, anti-rol o infracciones graves. Requiere pruebas.\n\n' +
                    '🤝 **Departamento de Alianzas:**\n' +
                    '> Si buscas colaborar con nuestra comunidad o proponer un convenio.\n\n' +
                    '🎫 **Atención VIP:**\n' +
                    '> Canal exclusivo para ciudadanos con beneficios activos. Prioridad inmediata.'
                )
                .addFields(
                    { name: '⏰ Horarios de atención', value: 'Disponibles 24/7 (Sujeto a disponibilidad de Staff)', inline: true },
                    { name: '🛡️ Seguridad', value: 'Tus datos están protegidos por encriptación King.', inline: true }
                )
                .setFooter({ 
                    text: 'Anda RP v3.5 • Sistema Protegido', 
                    iconURL: 'attachment://LogoPFP.png' 
                })
                .setTimestamp();

            const buttonRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('t_general')
                    .setLabel('Soporte General')
                    .setEmoji('📡')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('t_reporte')
                    .setLabel('Reportes')
                    .setEmoji('🚫')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('t_alianza')
                    .setLabel('Alianzas')
                    .setEmoji('🤝')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('t_vip')
                    .setLabel('Prioridad VIP')
                    .setEmoji('🎫')
                    .setStyle(ButtonStyle.Secondary)
            );

            await channel.send({ 
                embeds: [mainEmbed], 
                components: [buttonRow], 
                files: ['./attachment/LogoPFP.png'] 
            });

            console.log("✅ [TICKETS] Panel enviado con éxito.");
        } catch (error) {
            console.error("❌ [TICKETS_ERROR] Fallo al enviar el panel:", error);
        }
    },

    // --- 2. GESTOR DE INTERACCIONES Y LÓGICA DE NEGOCIO ---
    async handleTicketInteractions(interaction) {
        if (!interaction.guild) return;

        const { customId, guild, member, user, channel, fields } = interaction;
        
        // --- CONFIGURACIÓN DE IDs Y CANALES ---
        const logChannelId = '1476799509207060551';
        const rolComprasId = '1482153188856434828';
        const logoFile = './attachment/LogoPFP.png';

        // --- JERARQUÍA COMPLETA DE STAFF (0-9) ---
        const staffHierarchy = [
            '1476765837825277992', // [0] Helper
            '1476766248242118697', // [1] Mod en pruebas
            '1476766796861149284', // [2] Mod
            '1476767536530849822', // [3] Supervision basica
            '1476767750625038336', // [4] Administrador
            '1482153188856434828', // [5] Equipo de Compras
            '1476768019496829033', // [6] Supervision Avanzada
            '1476768122915782676', // [7] Manager
            '1476768405037125885', // [8] Community Manager
            '1476768951034970253'  // [9] Fundacion
        ];

        // --- CONFIGURACIÓN POR CATEGORÍA ---
        const ticketConfigs = {
            general: { 
                cat: '1489831086065324093', 
                role: staffHierarchy[0], 
                name: 'Soporte General', 
                prefix: 'soporte', 
                color: '#2ecc71' 
            },
            reporte: { 
                cat: '1489831182563672075', 
                role: staffHierarchy[1], 
                name: 'Reportes', 
                prefix: 'reporte', 
                color: '#e74c3c' 
            },
            vip: { 
                cat: '1489831182563672075', 
                role: '1476767461024989326', 
                name: 'Prioridad VIP', 
                prefix: 'vip', 
                color: '#f1c40f' 
            },
            alianza: { 
                cat: '1489831357357232218', 
                role: staffHierarchy[7], 
                name: 'Alianzas', 
                prefix: 'alianza', 
                color: '#3498db' 
            }
        };

        // --- A. GESTIÓN DE MODALES (ENTRADA DE DATOS) ---
        if (['t_general', 't_vip', 't_reporte', 't_alianza'].includes(customId)) {
            const type = customId.split('_')[1];
            const config = ticketConfigs[type];

            // Verificación de Rango VIP
            if (type === 'vip' && !member.roles.cache.has('1476765603418079434')) {
                return interaction.reply({ 
                    content: '🚫 **Acceso Restringido:** Solo los ciudadanos con rango VIP pueden abrir esta categoría.', 
                    ephemeral: true 
                });
            }

            const modal = new ModalBuilder()
                .setCustomId(`modal_ticket_${type}`)
                .setTitle(`Formulario: ${config.name}`);

            const rows = [];

            if (type === 'general' || type === 'vip') {
                const robloxInput = new TextInputBuilder()
                    .setCustomId('f_roblox')
                    .setLabel("Tu nombre de usuario en Roblox")
                    .setPlaceholder("Ej: JuanRP_123")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const motivoInput = new TextInputBuilder()
                    .setCustomId('f_motivo')
                    .setLabel("Describe tu problema o duda")
                    .setPlaceholder("Escribe detalladamente para agilizar el proceso...")
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true);

                rows.push(new ActionRowBuilder().addComponents(robloxInput));
                rows.push(new ActionRowBuilder().addComponents(motivoInput));
            } 
            
            else if (type === 'reporte') {
                const reportado = new TextInputBuilder()
                    .setCustomId('f_reportado')
                    .setLabel("Usuario reportado (Roblox/Discord)")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const suceso = new TextInputBuilder()
                    .setCustomId('f_suceso')
                    .setLabel("Descripción de la infracción")
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true);

                const pruebas = new TextInputBuilder()
                    .setCustomId('f_pruebas')
                    .setLabel("Link de pruebas (Imgur/YouTube)")
                    .setPlaceholder("Sin pruebas el ticket será ignorado.")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                rows.push(new ActionRowBuilder().addComponents(reportado));
                rows.push(new ActionRowBuilder().addComponents(suceso));
                rows.push(new ActionRowBuilder().addComponents(pruebas));
            }

            else if (type === 'alianza') {
                const comunidad = new TextInputBuilder()
                    .setCustomId('f_comunidad')
                    .setLabel("Nombre de tu Comunidad/Empresa")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const propuesta = new TextInputBuilder()
                    .setCustomId('f_propuesta')
                    .setLabel("Resumen de la propuesta")
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true);

                rows.push(new ActionRowBuilder().addComponents(comunidad));
                rows.push(new ActionRowBuilder().addComponents(propuesta));
            }

            modal.addComponents(...rows);
            return await interaction.showModal(modal);
        }

        // --- B. PROCESAMIENTO Y CREACIÓN DEL CANAL ---
        if (interaction.isModalSubmit() && customId.startsWith('modal_ticket_')) {
            await interaction.deferReply({ ephemeral: true });
            
            const type = customId.split('_')[2];
            const config = ticketConfigs[type];
            const ticketId = await getNextTicketId();

            try {
                // Creación de canal con permisos específicos
                const ticketChannel = await guild.channels.create({
                    name: `${config.prefix}-${ticketId}`,
                    type: ChannelType.GuildText,
                    parent: config.cat,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ReadMessageHistory] },
                        { id: config.role, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                        { id: staffHierarchy[8], allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] } // Community Manager siempre ve
                    ]
                });

                const welcomeEmbed = new EmbedBuilder()
                    .setColor(config.color)
                    .setTitle(`🎫 Ticket Abierto | ${config.name} #${ticketId}`)
                    .setAuthor({ name: 'Anda RP Sistema', iconURL: user.displayAvatarURL() })
                    .setDescription(`Hola <@${user.id}>, gracias por contactar con Anda RP. Un miembro del equipo de **${config.name}** revisará tu caso pronto.`)
                    .setThumbnail('attachment://LogoPFP.png');

                // Mapeo dinámico de respuestas del formulario al Embed
                fields.fields.forEach(field => {
                    const label = field.customId.replace('f_', '').toUpperCase();
                    welcomeEmbed.addFields({ name: `📌 ${label}`, value: `\`\`\`${field.value}\`\`\``, inline: false });
                });

                welcomeEmbed.setFooter({ text: 'Usa los botones de abajo para gestionar el ticket.' }).setTimestamp();

                const actionRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('btn_claim').setLabel('Reclamar').setEmoji('📌').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('btn_ascend').setLabel('Ascender').setEmoji('🚀').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('btn_compras').setLabel('Derivar Compras').setEmoji('💰').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('btn_close').setLabel('Cerrar Ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger)
                );

                await ticketChannel.send({ 
                    content: `<@${user.id}> | <@&${config.role}>`, 
                    embeds: [welcomeEmbed], 
                    components: [actionRow],
                    files: [logoFile]
                });

                // LOG DE APERTURA (KING LOGS)
                const logChannel = guild.channels.cache.get(logChannelId);
                if (logChannel) {
                    const logOpen = new EmbedBuilder()
                        .setColor('#2ecc71')
                        .setTitle('📁 Nuevo Ticket Creado')
                        .addFields(
                            { name: '🎫 ID', value: `\`${ticketId}\``, inline: true },
                            { name: '👤 Usuario', value: `${user} (\`${user.id}\`)`, inline: true },
                            { name: '📂 Canal', value: `${ticketChannel}`, inline: true },
                            { name: '🏷️ Tipo', value: config.name, inline: true }
                        )
                        .setTimestamp();
                    await logChannel.send({ embeds: [logOpen] });
                }

                await interaction.editReply(`✅ **Ticket creado con éxito:** ${ticketChannel}`);
            } catch (err) {
                console.error("CRITICAL_ERR_OPEN:", err);
                await interaction.editReply("❌ Hubo un error al intentar crear tu ticket. Contacta a un administrador.");
            }
        }

        // --- C. ACCIONES DE GESTIÓN (BOTONES INTERNOS) ---
        
        // 1. Reclamar Ticket
        if (customId === 'btn_claim') {
            const claimEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setDescription(`✅ El Staff <@${user.id}> ha tomado este ticket y será tu encargado principal.`)
                .setTimestamp();
            
            await interaction.reply({ embeds: [claimEmbed] });
            await channel.setName(`reclamado-${channel.name}`);
        }

        // 2. Derivar a Compras
        if (customId === 'btn_compras') {
            try {
                await channel.permissionOverwrites.edit(rolComprasId, { 
                    ViewChannel: true, 
                    SendMessages: true, 
                    AttachFiles: true 
                });
                
                const compEmbed = new EmbedBuilder()
                    .setColor('#5865f2')
                    .setTitle('💰 Derivación Técnica: Compras')
                    .setDescription('Este ticket ha sido marcado para revisión del departamento de **Compras y Donaciones**.\nUn encargado de esta área se unirá a la conversación.')
                    .setFooter({ text: 'Sistema de Traspaso Interno' });

                await interaction.reply({ content: `<@&${rolComprasId}>`, embeds: [compEmbed] });
            } catch (e) { console.error(e); }
        }

        // 3. Sistema de Ascenso (Jerarquía Progresiva)
        if (customId === 'btn_ascend') {
            let currentRankIndex = -1;
            
            // Detectar nivel actual del ticket basado en permisos
            for (let i = 0; i < staffHierarchy.length; i++) {
                if (channel.permissionOverwrites.cache.has(staffHierarchy[i])) {
                    currentRankIndex = i;
                }
            }

            const nextRankIndex = currentRankIndex + 1;

            if (nextRankIndex >= staffHierarchy.length) {
                return interaction.reply({ 
                    content: '⚠️ **Error:** El ticket ya se encuentra en el nivel jerárquico máximo (Fundación).', 
                    ephemeral: true 
                });
            }

            const nextRoleId = staffHierarchy[nextRankIndex];
            
            try {
                await channel.permissionOverwrites.edit(nextRoleId, { 
                    ViewChannel: true, 
                    SendMessages: true, 
                    AttachFiles: true 
                });

                const ascendEmbed = new EmbedBuilder()
                    .setColor('#e67e22')
                    .setTitle('🚀 Escalación de Ticket')
                    .setDescription(`El caso ha sido ascendido al rango superior: <@&${nextRoleId}>.`)
                    .addFields({ name: 'Solicitado por', value: `<@${user.id}>` })
                    .setTimestamp();

                await interaction.reply({ content: `<@&${nextRoleId}>`, embeds: [ascendEmbed] });
            } catch (err) {
                console.error("ASCEND_ERR:", err);
            }
        }

        // 4. Cierre del Ticket (Con Modal de Razón)
        if (customId === 'btn_close') {
            const closeModal = new ModalBuilder()
                .setCustomId('modal_confirm_close')
                .setTitle('Finalizar Atención');

            const razonInput = new TextInputBuilder()
                .setCustomId('f_razon_cierre')
                .setLabel("Razón del cierre / Resumen")
                .setPlaceholder("Ej: Solucionado en juego / Reporte inválido...")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            closeModal.addComponents(new ActionRowBuilder().addComponents(razonInput));
            return await interaction.showModal(closeModal);
        }

        // --- D. FINALIZACIÓN, TRANSCRIPT Y ELIMINACIÓN ---
        if (interaction.isModalSubmit() && customId === 'modal_confirm_close') {
            await interaction.deferReply();
            const razon = fields.getTextInputValue('f_razon_cierre');

            try {
                // Generación de Transcript Profesional
                const transcriptFile = await transcripts.createTranscript(channel, {
                    limit: -1,
                    fileName: `Transcript-${channel.name}.html`,
                    saveImages: true,
                    poweredBy: false,
                    hydrate: true
                });

                // Cálculo de Estadísticas (Mensajes Staff vs Usuario)
                const messages = await channel.messages.fetch({ limit: 100 });
                const staffMessages = messages.filter(m => !m.author.bot && m.author.id !== user.id);
                
                const statsMap = new Collection();
                staffMessages.forEach(msg => {
                    const count = statsMap.get(msg.author.id) || 0;
                    statsMap.set(msg.author.id, count + 1);
                });

                const statsSummary = statsMap.map((count, id) => `• <@${id}>: ${count} mensajes`).join('\n') || "Sin intervención de Staff.";

                // Envío de LOG Final (KING)
                const logChannel = guild.channels.cache.get(logChannelId);
                if (logChannel) {
                    const closeLog = new EmbedBuilder()
                        .setColor('#c0392b')
                        .setTitle('🔒 Ticket Cerrado y Archivado')
                        .setThumbnail(user.displayAvatarURL())
                        .addFields(
                            { name: '🎫 Canal', value: `\`${channel.name}\``, inline: true },
                            { name: '👤 Dueño', value: `<@${user.id}>`, inline: true },
                            { name: '🔒 Cerrado por', value: `<@${interaction.user.id}>`, inline: true },
                            { name: '📝 Razón de Cierre', value: `\`\`\`${razon}\`\`\`` },
                            { name: '📊 Resumen de Actividad', value: statsSummary }
                        )
                        .setFooter({ text: `Fecha de cierre: ${new Date().toLocaleString()}` });

                    await logChannel.send({ embeds: [closeLog], files: [transcriptFile] });
                }

                // Notificación al usuario por MD (Opcional)
                try {
                    await user.send(`Tu ticket en **Anda RP** (\`${channel.name}\`) ha sido cerrado.\n**Razón:** ${razon}`);
                } catch (e) { console.log("No se pudo enviar MD al usuario."); }

                await interaction.editReply({ 
                    embeds: [new EmbedBuilder().setColor('#ff0000').setDescription('⌛ **Ticket cerrado.** Este canal se autodestruirá en **10 segundos**.')] 
                });

                // Borrado definitivo
                setTimeout(() => {
                    channel.delete().catch(err => console.error("Error al borrar canal:", err));
                }, 10000);

            } catch (err) {
                console.error("CLOSE_PROCESS_ERR:", err);
                await interaction.editReply("❌ Error crítico durante el archivado. El canal se cerrará manualmente.");
            }
        }
    }
};