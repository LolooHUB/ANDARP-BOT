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
    MessageFlags,
    Collection,
    AttachmentBuilder
} = require('discord.js');
const { db, getNextTicketId } = require('./firebase');
const transcripts = require('discord-html-transcripts');

/**
 * 🏛️ SISTEMA DE TICKETS ELITE PRO - ANDA RP v5.5 (ULTRA EXPANDED)
 * ---------------------------------------------------------
 * CONFIGURACIÓN DE SEGURIDAD Y AUDITORÍA AVANZADA
 * ---------------------------------------------------------
 */

module.exports = {
    // --- 1. GENERACIÓN DEL PANEL PRINCIPAL ---
    async sendTicketPanel(channel) {
        try {
            const mainEmbed = new EmbedBuilder()
                .setColor('#050505')
                .setTitle('🏛️ Centro de Atención al Ciudadano - Anda RP')
                .setAuthor({ 
                    name: 'Administración Superior Anda RP', 
                    iconURL: 'attachment://LogoPFP.png' 
                })
                .setDescription(
                    'Bienvenido al nexo de comunicación oficial del servidor. ' +
                    'Nuestro equipo de soporte está capacitado para resolver tus dudas y solicitudes con la mayor eficiencia posible.\n\n' +
                    '**CATEGORÍAS DISPONIBLES:**\n' +
                    '📡 **Soporte General:** Inconvenientes técnicos, bugs o dudas sobre el servidor.\n' +
                    '🚫 **Reportes:** Denuncias de infracciones de normativa por parte de otros usuarios.\n' +
                    '🤝 **Alianzas:** Relaciones externas, convenios y colaboraciones con otros proyectos.\n' +
                    '👨‍⚖️ **Facciones:** Trámites de ingreso, dudas legales o gestión de bandas/mafias.\n\n' +
                    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
                    '⚠️ **AVISO DE PRIORIDAD AUTOMÁTICA:**\n' +
                    '*Nuestro sistema detecta automáticamente tu rango. Si posees beneficios VIP, ' +
                    'tu solicitud será redirigida a la cola de alta prioridad sin selección manual.*'
                )
                .addFields(
                    { name: '🛡️ SEGURIDAD', value: 'Cada ticket genera una transcripción cifrada para evitar casos de corrupción o abuso de poder.', inline: false },
                    { name: '⏱️ TIEMPOS ESTIMADOS', value: '• **Estándar:** 12 a 24 horas.\n• **VIP / Prioridad:** Menos de 4 horas.', inline: false},
                )
                .setImage('attachment://BannerTickets.png') 
                .setFooter({ 
                    text: 'Anda RP - Infraestructura de Soporte 2026 | Desarrollado para Calidad', 
                    iconURL: 'attachment://LogoPFP.png' 
                })
                .setTimestamp();

            const actionRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('t_general').setLabel('Soporte General').setEmoji('📡').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('t_reporte').setLabel('Reportes').setEmoji('🚫').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('t_alianza').setLabel('Alianzas').setEmoji('🤝').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('t_facciones').setLabel('Facciones').setEmoji('👨‍⚖️').setStyle(ButtonStyle.Secondary)
            );

            await channel.send({ 
                embeds: [mainEmbed], 
                components: [actionRow], 
                files: ['./attachment/LogoPFP.png', './attachment/BannerTickets.png'] 
            });

            console.log("✅ PANEL DESPLEGADO CON ÉXITO");
        } catch (error) {
            console.error("❌ ERROR CRÍTICO AL ENVIAR PANEL:", error);
        }
    },

    // --- 2. MANEJO CENTRALIZADO DE INTERACCIONES ---
    async handleTicketInteractions(interaction) {
        if (!interaction.guild) return;
        
        const { customId, guild, member, user, channel, fields } = interaction;
        
        // --- ⚙️ CONFIGURACIÓN MAESTRA ---
        const logChannelId = '1476799509207060551';
        const rolComprasId = '1482153188856434828';
        const catComprasId = '1491985711765782640';
        const catFaccionesId = '1491988211281559622';
        const catVipPrioridadId = '1489831182563672075'; 
        const pingNotificacionesId = '1476800914818859018';
        const rolesVipIds = ['1494130913251168267', '1476765603418079434'];

        // JERARQUÍA MAESTRA DE STAFF
        const staffHierarchy = [
            '1476765837825277992', // [0] Helper
            '1476766248242118697', // [1] Mod en pruebas
            '1476766796861149284', // [2] Mod
            '1476767536530849822', // [3] Supervision basica
            '1476767750625038336', // [4] Administrador
            '1476768019496829033', // [5] Supervision Avanzada
            '1476768122915782676', // [6] Manager
            '1476768405037125885', // [7] Community Manager
            '1476768951034970253'  // [8] Fundacion
        ];

        const configs = {
            general: { cat: '1489831086065324093', role: staffHierarchy[0], n: 'Soporte General', prefix: 'soporte', emoji: '📡' },
            reporte: { cat: '1489831182563672075', role: staffHierarchy[1], n: 'Reportes', prefix: 'reporte', emoji: '🚫' },
            alianza: { cat: '1489831357357232218', role: staffHierarchy[6], n: 'Alianzas', prefix: 'alianza', emoji: '🤝' },
            facciones: { cat: catFaccionesId, role: staffHierarchy[5], n: 'Facciones', prefix: 'fac', emoji: '👨‍⚖️' }
        };

        // --- A. SOLICITUD DE MODALES Y ANTIDUPLICADOS ---
        if (['t_general', 't_reporte', 't_alianza', 't_facciones'].includes(customId)) {
            const type = customId.replace('t_', '');
            
            const existingTicket = guild.channels.cache.find(c => 
                c.name.includes(configs[type].prefix) && c.permissionOverwrites.cache.has(user.id)
            );

            if (existingTicket) {
                return interaction.reply({ 
                    content: `⚠️ Protocolo de Seguridad: Ya posees un expediente abierto en ${existingTicket}.`, 
                    flags: MessageFlags.Ephemeral 
                });
            }

            // Validación específica para Facciones
            if (customId === 't_facciones') {
                const hasFacAccess = member.roles.cache.has('1476791384894865419') || member.permissions.has(PermissionFlagsBits.Administrator);
                if (!hasFacAccess) {
                    return interaction.reply({ 
                        content: '🚫 **ACCESO RESTRINGIDO:** Debes validar tu identidad faccionaria en <#1476790443919540367> antes de abrir este ticket.', 
                        flags: MessageFlags.Ephemeral 
                    });
                }
            }

            const modal = new ModalBuilder().setCustomId(`modal_t_${type}`).setTitle(`Formulario de ${configs[type].n}`);
            const inputUser = new TextInputBuilder().setCustomId('f_user').setLabel("Nombre en Roblox / In-Game").setPlaceholder("Ej: Roberto_Gomez").setStyle(TextInputStyle.Short).setRequired(true).setMinLength(3);

            if (type === 'general') {
                const inputMotivo = new TextInputBuilder().setCustomId('f_motivo').setLabel("Descripción del Inconveniente").setStyle(TextInputStyle.Paragraph).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(inputUser), new ActionRowBuilder().addComponents(inputMotivo));
            } else if (type === 'reporte') {
                const inputTarget = new TextInputBuilder().setCustomId('f_target').setLabel("Usuario a Reportar").setStyle(TextInputStyle.Short).setRequired(true);
                const inputRazon = new TextInputBuilder().setCustomId('f_razon').setLabel("Motivo y Pruebas").setStyle(TextInputStyle.Paragraph).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(inputUser), new ActionRowBuilder().addComponents(inputTarget), new ActionRowBuilder().addComponents(inputRazon));
            } else if (type === 'alianza') {
                const inputComu = new TextInputBuilder().setCustomId('f_comu').setLabel("Nombre de la Comunidad").setStyle(TextInputStyle.Short).setRequired(true);
                const inputProp = new TextInputBuilder().setCustomId('f_prop').setLabel("Propuesta Detallada").setStyle(TextInputStyle.Paragraph).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(inputUser), new ActionRowBuilder().addComponents(inputComu), new ActionRowBuilder().addComponents(inputProp));
            } else if (type === 'facciones') {
                const inputF1 = new TextInputBuilder().setCustomId('f_fname').setLabel("Nombre de la Facción").setStyle(TextInputStyle.Short).setRequired(true);
                const inputF2 = new TextInputBuilder().setCustomId('f_ftype').setLabel("Tipo (Mafia/Seguridad/Privado)").setStyle(TextInputStyle.Short).setRequired(true);
                const inputF3 = new TextInputBuilder().setCustomId('f_fhist').setLabel("Lore y Objetivos").setStyle(TextInputStyle.Paragraph).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(inputUser), new ActionRowBuilder().addComponents(inputF1), new ActionRowBuilder().addComponents(inputF2), new ActionRowBuilder().addComponents(inputF3));
            }

            return await interaction.showModal(modal);
        }

        // --- B. PROCESAMIENTO Y CREACIÓN DE EXPEDIENTE ---
        if (interaction.isModalSubmit() && customId.startsWith('modal_t_')) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            
            const type = customId.replace('modal_t_', '');
            const config = configs[type];
            const ticketId = await getNextTicketId();
            
            const isVip = rolesVipIds.some(id => member.roles.cache.has(id));
            const finalCategory = isVip ? catVipPrioridadId : config.cat;
            const finalName = `${isVip ? '⭐vip-' : ''}${config.prefix}-${ticketId}`;

            try {
                const tChannel = await guild.channels.create({
                    name: finalName,
                    type: ChannelType.GuildText,
                    parent: finalCategory,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
                        { id: config.role, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                        { id: staffHierarchy[8], allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                    ]
                });

                const welcomeEmbed = new EmbedBuilder()
                    .setColor(isVip ? '#F1C40F' : '#050505')
                    .setTitle(`${isVip ? '💎 EXPEDIENTE PRIORITARIO' : config.emoji + ' EXPEDIENTE ' + config.n}`)
                    .setDescription(`Bienvenido <@${user.id}>. Tu caso ha sido registrado en el sistema.\n\n**STATUS:** 📥 Pendiente de Staff\n**TIPO:** ${config.n}\n**VIP:** ${isVip ? 'Activado' : 'No'}`)
                    .setThumbnail(isVip ? 'https://i.imgur.com/8QWvM6O.png' : 'https://i.imgur.com/Tu7Gz2T.png')
                    .setFooter({ text: `Protocolo Anda RP v5.5 | ID: ${tChannel.id}`, iconURL: 'attachment://LogoPFP.png' });

                fields.fields.forEach(f => {
                    welcomeEmbed.addFields({ name: `┃ ${f.customId.replace('f_', '').toUpperCase()}`, value: `> ${f.value || 'N/A'}` });
                });

                const row1 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('ticket_reclamar').setLabel('Reclamar').setEmoji('📌').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('ticket_ascender').setLabel('Ascender').setEmoji('🚀').setStyle(ButtonStyle.Primary)
                );
                const row2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('ticket_notificar').setLabel('Notificar').setEmoji('🔔').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('ticket_cerrar').setLabel('Cerrar').setEmoji('🔒').setStyle(ButtonStyle.Danger)
                );

                await tChannel.send({ 
                    content: `<@&${pingNotificacionesId}> ${isVip ? '⭐ **SOPORTE VIP REQUERIDO**' : ''}`, 
                    embeds: [welcomeEmbed], 
                    components: [row1, row2],
                    files: ['./attachment/LogoPFP.png']
                });

                // Registro en Base de Datos
                await db.collection('stats_tickets').add({
                    id: tChannel.id,
                    user: user.id,
                    type: type,
                    isVip: isVip,
                    openedAt: new Date()
                });

                await interaction.editReply(`✅ **Expediente Generado:** ${tChannel}`);

            } catch (err) {
                console.error("ERROR CREACIÓN:", err);
                await interaction.editReply("❌ Error interno al crear el canal.");
            }
        }

        // --- C. ACCIÓN: RECLAMAR ---
        if (customId === 'ticket_reclamar') {
            const isStaff = staffHierarchy.some(id => member.roles.cache.has(id)) || member.permissions.has(PermissionFlagsBits.Administrator);
            if (!isStaff) return interaction.reply({ content: '🚫 Solo Staff autorizado.', flags: MessageFlags.Ephemeral });

            // Detectar al creador del ticket buscando el permiso de ViewChannel en el canal
            const creatorId = channel.permissionOverwrites.cache.filter(p => p.type === 1 && !staffHierarchy.includes(p.id) && p.id !== guild.ownerId).first()?.id;

            const claimEmbed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setAuthor({ name: 'Expediente Asignado', iconURL: user.displayAvatarURL() })
                .setDescription(`🏛️ El integrante del staff **${user.tag}** ha tomado este caso.\n\n*Por favor, evita mencionar innecesariamente a otros miembros.*`)
                .setTimestamp();

            await interaction.reply({ 
                content: creatorId ? `<@${creatorId}>` : '', 
                embeds: [claimEmbed] 
            });

            await channel.setName(`atendido-${channel.name}`).catch(() => {});

            const logChan = guild.channels.cache.get(logChannelId);
            if (logChan) {
                logChan.send({ content: `📌 **TICKET RECLAMADO:** El staff **${user.tag}** (ID: \`${user.id}\`) ha iniciado atención en \`${channel.name}\`.` });
            }
        }

        // --- D. ACCIÓN: ASCENDER (LÓGICA PERSONALIZADA) ---
        if (customId === 'ticket_ascender') {
            // Analizar roles presentes en permisos
            const rolesEnCanal = staffHierarchy.filter(id => channel.permissionOverwrites.cache.has(id));
            const idActual = rolesEnCanal[rolesEnCanal.length - 1];
            const indexActual = staffHierarchy.indexOf(idActual);

            let indexSiguiente;
            
            // Lógica de escalado solicitada
            if (indexActual <= 2) { 
                indexSiguiente = 3; // Helper/Mod -> Supervision Basica
            } else if (indexActual === 3) {
                indexSiguiente = 4; // -> Admin
            } else if (indexActual === 4) {
                indexSiguiente = 5; // -> Supervision Avanzada
            } else if (indexActual === 5) {
                indexSiguiente = 6; // -> Manager
            } else {
                indexSiguiente = 8; // -> Fundacion
            }

            if (indexSiguiente >= staffHierarchy.length || indexActual === 8) {
                return interaction.reply({ content: '⚠️ El expediente ya está en el máximo nivel jerárquico.', flags: MessageFlags.Ephemeral });
            }

            const rolNuevo = staffHierarchy[indexSiguiente];
            
            // Ajuste de permisos dinámico
            await channel.permissionOverwrites.edit(rolNuevo, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
            if (idActual) await channel.permissionOverwrites.edit(idActual, { SendMessages: false }); // Rango anterior solo lectura

            const ascEmbed = new EmbedBuilder()
                .setColor('#E67E22')
                .setTitle('🚀 PROTOCOLO DE ESCALADO ACTIVADO')
                .setDescription(`Este expediente ha sido elevado a <@&${rolNuevo}> para su resolución.\n\n🔒 **Integridad:** Los rangos inferiores han sido restringidos a Solo Lectura.`);

            await interaction.reply({ content: `⚠️ Intervención superior solicitada: <@&${rolNuevo}>`, embeds: [ascEmbed] });
        }

        // --- E. ACCIÓN: NOTIFICAR ---
        if (customId === 'ticket_notificar') {
            const creatorId = channel.permissionOverwrites.cache.filter(p => p.type === 1 && !staffHierarchy.includes(p.id)).first()?.id;
            await interaction.reply({ 
                content: creatorId ? `<@${creatorId}>, el staff requiere tu atención inmediata aquí.` : '👋 Hola, por favor mantente atento a las actualizaciones del staff.',
            });
        }

        // --- F. CIERRE Y TRANSCRIPT ---
        if (customId === 'ticket_cerrar') {
            const modal = new ModalBuilder().setCustomId('modal_pre_close').setTitle('Cierre de Expediente');
            const razon = new TextInputBuilder().setCustomId('f_resolucion').setLabel("Resolución Final").setStyle(TextInputStyle.Paragraph).setRequired(true).setPlaceholder("Detalla la solución brindada...");
            modal.addComponents(new ActionRowBuilder().addComponents(razon));
            return await interaction.showModal(modal);
        }

        if (interaction.isModalSubmit() && customId === 'modal_pre_close') {
            await interaction.deferReply();
            const resolucion = fields.getTextInputValue('f_resolucion');
            
            try {
                const attachment = await transcripts.createTranscript(channel, {
                    limit: -1,
                    fileName: `Transcript-${channel.name}.html`,
                    saveImages: true,
                    poweredBy: false
                });

                // Registro para la Web
                await db.collection('transcripts_v5').doc(channel.name).set({
                    id: channel.name,
                    staff_id: user.id,
                    staff_tag: user.tag,
                    resolucion: resolucion,
                    closedAt: new Date()
                });

                const logEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('📄 REPORTE DE CIERRE')
                    .addFields(
                        { name: '📂 ID:', value: `\`${channel.name}\``, inline: true },
                        { name: '👮 Staff:', value: `**${user.tag}**`, inline: true },
                        { name: '📝 Resolución:', value: `\`\`\`${resolucion}\`\`\`` },
                        { name: '🔗 Visor:', value: `[Acceso Gubernamental](https://andarp.web.app/tickets/view?id=${channel.name})` }
                    )
                    .setTimestamp();

                const logChan = guild.channels.cache.get(logChannelId);
                if (logChan) await logChan.send({ embeds: [logEmbed], files: [attachment] });

                await interaction.editReply('✅ **EXPEDIENTE CERRADO.** El canal se eliminará en 10 segundos.');
                
                // Intento de envío de MD al usuario
                const creatorId = channel.permissionOverwrites.cache.filter(p => p.type === 1 && !staffHierarchy.includes(p.id)).first()?.id;
                if (creatorId) {
                    const target = await guild.members.fetch(creatorId).catch(() => null);
                    if (target) {
                        const dmEmbed = new EmbedBuilder().setColor('#3498DB').setTitle('🏛️ Ticket Finalizado - Anda RP').setDescription(`Tu ticket \`${channel.name}\` ha sido cerrado.\n\n**Resolución:** ${resolucion}`);
                        await target.send({ embeds: [dmEmbed] }).catch(() => {});
                    }
                }

                setTimeout(() => channel.delete().catch(() => {}), 10000);

            } catch (e) {
                console.error("ERROR CIERRE:", e);
                await channel.delete().catch(() => {});
            }
        }
    }
};

/**
 * ---------------------------------------------------------
 * 📊 ESTADÍSTICAS Y CONTROL DE CALIDAD
 * ---------------------------------------------------------
 * - Versión: 5.5.0
 * - Lógica de Ascenso Dinámica: Incluida
 * - Fix Pings (Staff/Usuario): Incluido
 * - Soporte Multi-Categoría: Incluido
 * ---------------------------------------------------------
 */