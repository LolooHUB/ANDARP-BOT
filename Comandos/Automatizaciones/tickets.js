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
 * 🏛️ SISTEMA DE TICKETS ELITE PRO - ANDA RP v5.0 (ULTRA EDITION)
 * ---------------------------------------------------------
 * LÓGICA DE NEGOCIO AVANZADA:
 * 1. VIP AUTOMÁTICO: Detección por rol sin botones visibles.
 * 2. ESCALABILIDAD: 10 niveles de staff con herencia de permisos.
 * 3. AUDITORÍA: Sistema de logs extendido y métricas en Firebase.
 * 4. FEEDBACK: Sistema de valoración de atención al cerrar.
 * ---------------------------------------------------------
 */

module.exports = {
    // --- 1. GENERACIÓN DEL PANEL PRINCIPAL (LIMPIO Y PROFESIONAL) ---
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
                '*Nuestro sistema detecta automáticamente tu rango en la ciudad. Si posees beneficios de ciudadano VIP, ' +
                'tu solicitud será redirigida automáticamente a la cola de alta prioridad sin necesidad de selección manual.*'
            )
            .addFields(
                { name: '🛡️ SEGURIDAD', value: 'Cada ticket genera una transcripción cifrada que se guarda en nuestra base de datos para evitar casos de corrupción o abuso de poder.', inline: false },
                { name: '⏱️ TIEMPOS ESTIMADOS', value: '• **Estándar:** 12 a 24 horas.\n• **VIP / Prioridad:** Menos de 4 horas.', inline: false},
            )
            // Cambiado a setImage para que luzca como un banner real abajo
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

        // ✅ LA CLAVE: Añadir ambos archivos aquí
        await channel.send({ 
            embeds: [mainEmbed], 
            components: [actionRow], 
            files: [
                './attachment/LogoPFP.png', 
                './attachment/BannerTickets.png' // <-- Faltaba este archivo
            ] 
        });

        console.log("✅ PANEL DESPLEGADO CON BANNER");
    } catch (error) {
        console.error("❌ ERROR AL ENVIAR PANEL:", error);
    }
},

    // --- 2. MANEJO CENTRALIZADO DE INTERACCIONES (MOTOR DE LÓGICA) ---
    async handleTicketInteractions(interaction) {
        if (!interaction.guild) return;
        
        const { customId, guild, member, user, channel, fields } = interaction;
        
        // --- ⚙️ CONFIGURACIÓN DE IDS Y PERMISOS ---
        const logChannelId = '1476799509207060551';
        const rolComprasId = '1482153188856434828';
        const catComprasId = '1491985711765782640';
        const catFaccionesId = '1491988211281559622';
        const catVipPrioridadId = '1489831182563672075'; 
        const rolVipId = '1476765603418079434'; 
        const pingNotificacionesId = '1476800914818859018';
        const logoPath = './attachment/LogoPFP.png';
        const bannerPath = './attachment/BannerTickets.png';

        // JERARQUÍA MAESTRA DE STAFF (0 a 9)
        const staffHierarchy = [
            '1476765837825277992', // [0] Helper
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

        const configs = {
            general: { cat: '1489831086065324093', role: staffHierarchy[0], n: 'Soporte General', prefix: 'soporte', emoji: '📡' },
            reporte: { cat: '1489831182563672075', role: staffHierarchy[1], n: 'Reportes', prefix: 'reporte', emoji: '🚫' },
            alianza: { cat: '1489831357357232218', role: staffHierarchy[7], n: 'Alianzas', prefix: 'alianza', emoji: '🤝' },
            facciones: { cat: catFaccionesId, role: staffHierarchy[6], n: 'Facciones', prefix: 'fac', emoji: '👨‍⚖️' }
        };

        // --- A. SOLICITUD DE MODALES Y ANTIDUPLICADOS ---
        if (['t_general', 't_reporte', 't_alianza', 't_facciones'].includes(customId)) {
            const type = customId.replace('t_', '');
            
            // Verificación de Duplicados en todo el gremio
            const existingTicket = guild.channels.cache.find(c => 
                c.name.includes(configs[type].prefix) && 
                c.permissionOverwrites.cache.has(user.id)
            );

            if (existingTicket) {
                return interaction.reply({ 
                    content: `⚠️ Error de protocolo: Ya tienes un ticket activo en ${existingTicket}. Por favor, cierra el anterior antes de iniciar uno nuevo.`, 
                    flags: MessageFlags.Ephemeral 
                });
            }

            // Validación de Permisos para Facciones
            if (customId === 't_facciones') {
                const hasAccess = staffHierarchy.slice(6).some(id => member.roles.cache.has(id)) || member.permissions.has(PermissionFlagsBits.Administrator);
                if (!hasAccess && !member.roles.cache.has('1476791384894865419')) { // Si no es staff avanzado ni fundación
                    return interaction.reply({ 
                        content: '🚫 Acceso Denegado: Las solicitudes de Facciones requieren validación de Supervisión Avanzada.', 
                        flags: MessageFlags.Ephemeral 
                    });
                }
            }

            // Construcción del Formulario Específico
            const modal = new ModalBuilder().setCustomId(`modal_t_${type}`).setTitle(`Formulario de ${configs[type].n}`);

            const inputUser = new TextInputBuilder().setCustomId('f_user').setLabel("Tu nombre en Roblox/In-game").setPlaceholder("Ej: Roberto_Gomez").setStyle(TextInputStyle.Short).setRequired(true).setMinLength(3);
            
            if (type === 'general') {
                const inputMotivo = new TextInputBuilder().setCustomId('f_motivo').setLabel("Describe tu problema").setStyle(TextInputStyle.Paragraph).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(inputUser), new ActionRowBuilder().addComponents(inputMotivo));
            } else if (type === 'reporte') {
                const inputReportado = new TextInputBuilder().setCustomId('f_target').setLabel("Usuario reportado (Nombre o ID)").setStyle(TextInputStyle.Short).setRequired(true);
                const inputRazon = new TextInputBuilder().setCustomId('f_razon').setLabel("Norma infringida y contexto").setStyle(TextInputStyle.Paragraph).setRequired(true);
                const inputPruebas = new TextInputBuilder().setCustomId('f_links').setLabel("Evidencia (Links de Discord/YouTube)").setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(
                    new ActionRowBuilder().addComponents(inputUser), 
                    new ActionRowBuilder().addComponents(inputReportado),
                    new ActionRowBuilder().addComponents(inputRazon),
                    new ActionRowBuilder().addComponents(inputPruebas)
                );
            } else if (type === 'alianza') {
                const inputAlianza = new TextInputBuilder().setCustomId('f_comu').setLabel("Comunidad/Empresa").setStyle(TextInputStyle.Short).setRequired(true);
                const inputPropuesta = new TextInputBuilder().setCustomId('f_prop').setLabel("¿En qué consiste la alianza?").setStyle(TextInputStyle.Paragraph).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(inputUser), new ActionRowBuilder().addComponents(inputAlianza), new ActionRowBuilder().addComponents(inputPropuesta));
            } else if (type === 'facciones') {
                const inputFacName = new TextInputBuilder().setCustomId('f_fname').setLabel("Nombre de la Facción").setStyle(TextInputStyle.Short).setRequired(true);
                const inputFacTipo = new TextInputBuilder().setCustomId('f_ftype').setLabel("Tipo: Mafias / Fuerza Seguridad / Privado / Servicio de Emergencias.").setStyle(TextInputStyle.Short).setRequired(true);
                const inputFacCant = new TextInputBuilder().setCustomId('f_fcount').setLabel("Cantidad de miembros aproximada").setStyle(TextInputStyle.Short).setRequired(true);
                const inputFacHist = new TextInputBuilder().setCustomId('f_fhist').setLabel("Breve Lore o Historia").setStyle(TextInputStyle.Paragraph).setRequired(true);
                modal.addComponents(
                    new ActionRowBuilder().addComponents(inputUser),
                    new ActionRowBuilder().addComponents(inputFacName),
                    new ActionRowBuilder().addComponents(inputFacTipo),
                    new ActionRowBuilder().addComponents(inputFacCant),
                    new ActionRowBuilder().addComponents(inputFacHist)
                );
            }

            return await interaction.showModal(modal);
        }

        // --- B. PROCESAMIENTO Y CREACIÓN (LÓGICA VIP AUTOMÁTICA) ---
        if (interaction.isModalSubmit() && customId.startsWith('modal_t_')) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
            
            const type = customId.replace('modal_t_', '');
            const config = configs[type];
            const ticketId = await getNextTicketId();
            
            // 🌟 DETECCIÓN DE ESTATUS VIP INTEGRADA
            const isVip = member.roles.cache.has(rolVipId);
            const finalCategory = isVip ? catVipPrioridadId : config.cat;
            const finalName = isVip ? `⭐vip-${config.prefix}-${ticketId}` : `${config.prefix}-${ticketId}`;

            try {
                const tChannel = await guild.channels.create({
                    name: finalName,
                    type: ChannelType.GuildText,
                    parent: finalCategory,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks] },
                        { id: config.role, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                        { id: staffHierarchy[9], allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] } // Fundación siempre ve
                    ]
                });

                const welcomeEmbed = new EmbedBuilder()
                    .setColor(isVip ? '#F1C40F' : '#050505')
                    .setTitle(`${isVip ? '💎 EXPEDIENTE PRIORITARIO' : config.emoji + ' EXPEDIENTE ' + config.n}`)
                    .setAuthor({ name: `Usuario: ${user.tag}`, iconURL: user.displayAvatarURL() })
                    .setDescription(
                        `Hola <@${user.id}>, bienvenido a tu canal de soporte personalizado.\n\n` +
                        `**ESTADO:** 📥 Esperando asignación de Staff.\n` +
                        `**PRIORIDAD:** ${isVip ? '🔴 ALTA (Beneficio VIP Detectado)' : '🟢 ESTÁNDAR'}\n\n` +
                        `**INFORMACIÓN PROPORCIONADA:**`
                    )
                    .setThumbnail(isVip ? 'https://i.imgur.com/8QWvM6O.png' : 'https://i.imgur.com/Tu7Gz2T.png')
                    .setFooter({ text: `ID Único: ${tChannel.id} | Anda RP v5.0`, iconURL: 'attachment://LogoPFP.png' });

                fields.fields.forEach(f => {
                    welcomeEmbed.addFields({ name: `┃ ${f.customId.replace('f_', '').toUpperCase()}`, value: `> ${f.value || 'No proporcionado'}` });
                });

                const row1 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('ticket_reclamar').setLabel('Reclamar').setEmoji('📌').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('ticket_ascender').setLabel('Ascender').setEmoji('🚀').setStyle(ButtonStyle.Primary)
                );
                
                const row2 = new ActionRowBuilder();
                if (type !== 'facciones' && type !== 'reporte') {
                    row2.addComponents(new ButtonBuilder().setCustomId('ticket_compras').setLabel('Área de Compras').setEmoji('💰').setStyle(ButtonStyle.Secondary));
                }
                row2.addComponents(
                    new ButtonBuilder().setCustomId('ticket_notificar').setLabel('Notificar Usuario').setEmoji('🔔').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('ticket_cerrar').setLabel('Finalizar').setEmoji('🔒').setStyle(ButtonStyle.Danger)
                );

                await tChannel.send({ 
                    content: isVip ? `⭐ **ATENCIÓN VIP:** <@&${staffHierarchy[4]}>` : `🔔 **NUEVA SOLICITUD:** <@&${config.role}>`, 
                    embeds: [welcomeEmbed], 
                    components: [row1, row2], 
                    files: [logoPath] 
                });

                // Registro en DB del ticket abierto
                await db.collection('stats_tickets').add({
                    user: user.id,
                    type: type,
                    channel: tChannel.id,
                    isVip: isVip,
                    openedAt: new Date()
                });

                await interaction.editReply(`✅ **¡Éxito!** Tu ticket ha sido generado correctamente: ${tChannel}`);

            } catch (err) {
                console.error("❌ ERROR EN CREACIÓN DE CANAL:", err);
                await interaction.editReply("❌ El sistema no pudo crear el canal. Verifica los permisos del bot.");
            }
        }

        // --- C. ACCIÓN: RECLAMAR (CON LOGS) ---
        if (customId === 'ticket_reclamar') {
            const isStaff = staffHierarchy.some(id => member.roles.cache.has(id)) || member.permissions.has(PermissionFlagsBits.Administrator);
            if (!isStaff) return interaction.reply({ content: '🚫 Solo el personal autorizado puede reclamar expedientes.', flags: MessageFlags.Ephemeral });

            const claimEmbed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setAuthor({ name: 'Expediente Asignado', iconURL: user.displayAvatarURL() })
                .setDescription(`🏛️ El integrante del staff **${user.tag}** ha tomado este caso y te asistirá en breve.\n\n*Por favor, evita mencionar a otros miembros del staff.*`)
                .setTimestamp();
            
            await interaction.reply({ embeds: [claimEmbed] });
            await channel.setName(`atendido-${channel.name}`).catch(() => {});
            
            // Log de Reclamo
            const logChan = guild.channels.cache.get(logChannelId);
            if (logChan) {
                logChan.send({ content: `📌 **TICKET RECLAMADO:** El staff <@${user.id}> tomó el canal ${channel.name}` });
            }
        }

        // --- D. ACCIÓN: NOTIFICAR (AVISO AL USUARIO) ---
        if (customId === 'ticket_notificar') {
            const ownerId = channel.name.split('-').pop(); // Intento de obtener ID o simplemente ping al creador
            await interaction.reply({ 
                content: `👋 Hola, el staff está revisando tu caso. Por favor, mantente atento a este canal para recibir actualizaciones.`,
                allowedMentions: { parse: ['users'] }
            });
        }

        // --- E. ACCIÓN: ASCENDER (LÓGICA DE JERARQUÍA RECURSIVA) ---
        if (customId === 'ticket_ascender') {
            let rolesEnCanal = [];
            staffHierarchy.forEach((roleId, index) => {
                if (channel.permissionOverwrites.cache.has(roleId)) rolesEnCanal.push(index);
            });

            const nivelActual = rolesEnCanal.length > 0 ? Math.max(...rolesEnCanal) : -1;
            let nivelSiguiente = (nivelActual < 4) ? 4 : nivelActual + 1; // Salto directo a Admin si es rango bajo

            if (nivelSiguiente >= staffHierarchy.length) {
                return interaction.reply({ content: '🎭 **OPERACIÓN INVÁLIDA:** El expediente ya se encuentra en el nivel de resolución más alto disponible (Fundación).', flags: MessageFlags.Ephemeral });
            }

            await interaction.deferUpdate();
            const rolNuevo = staffHierarchy[nivelSiguiente];
            const rolViejo = nivelActual !== -1 ? staffHierarchy[nivelActual] : null;

            // Transición de Permisos
            if (rolViejo) await channel.permissionOverwrites.edit(rolViejo, { SendMessages: false, ViewChannel: true });
            await channel.permissionOverwrites.edit(user.id, { SendMessages: false }); // El staff que asciende pierde escritura
            
            await channel.permissionOverwrites.edit(rolNuevo, { 
                ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true 
            });

            const ascEmbed = new EmbedBuilder()
                .setColor('#E67E22')
                .setTitle('🚀 PROTOCOLO DE ESCALADO')
                .setDescription(
                    `Este caso requiere una autoridad superior y ha sido elevado a <@&${rolNuevo}>.\n\n` +
                    `🔒 **Nivel de Acceso:** Los rangos inferiores han sido restringidos a **Solo Lectura** para preservar la integridad de la resolución.`
                )
                .setFooter({ text: 'Escalado solicitado por ' + user.tag });

            await channel.send({ content: `⚠️ <@&${rolNuevo}> - Se requiere intervención inmediata.`, embeds: [ascEmbed] });
        }

        // --- F. ACCIÓN: CIERRE Y SISTEMA DE FEEDBACK ---
        if (customId === 'ticket_cerrar') {
            const modal = new ModalBuilder().setCustomId('modal_pre_close').setTitle('Finalización de Expediente');
            const razon = new TextInputBuilder().setCustomId('f_resolucion').setLabel("Resolución final del caso").setStyle(TextInputStyle.Paragraph).setRequired(true).setPlaceholder("Escribe qué se hizo para solucionar el problema...");
            modal.addComponents(new ActionRowBuilder().addComponents(razon));
            return await interaction.showModal(modal);
        }

        if (interaction.isModalSubmit() && customId === 'modal_pre_close') {
            await interaction.deferReply().catch(() => {});
            const resolucion = fields.getTextInputValue('f_resolucion');
            
            try {
                // Generación de Transcripción Profesional
                const attachment = await transcripts.createTranscript(channel, {
                    limit: -1,
                    fileName: `Transcript-${channel.name}.html`,
                    saveImages: true,
                    poweredBy: false
                });

                const transcriptHTML = await transcripts.createTranscript(channel, { limit: -1, returnType: 'string', poweredBy: false });
                
                // Registro en Base de Datos para el Panel Gubernamental
                await db.collection('transcripts_v5').doc(channel.name).set({
                    id: channel.name,
                    staff_close: user.tag,
                    staff_id: user.id,
                    resolucion: resolucion,
                    html_content: transcriptHTML,
                    closedAt: new Date(),
                    channel_id: channel.id
                });

                const logEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('📄 REGISTRO DE CIERRE DE EXPEDIENTE')
                    .addFields(
                        { name: '📂 Identificador:', value: `\`${channel.name}\``, inline: true },
                        { name: '👮 Staff Responsable:', value: `${user.tag} (\`${user.id}\`)`, inline: true },
                        { name: '📝 Resolución Final:', value: `\`\`\`${resolucion}\`\`\`` },
                        { name: '🔗 Visor Web:', value: `[Abrir Expediente Online](https://andarp.web.app/tickets/view?id=${channel.name})` }
                    )
                    .setThumbnail(user.displayAvatarURL())
                    .setTimestamp();

                const logChan = guild.channels.cache.get(logChannelId);
                if (logChan) {
                    await logChan.send({ embeds: [logEmbed], files: [attachment] });
                }
                
                // Mensaje final en el canal antes de borrar
                await interaction.editReply('✅ **EXPEDIENTE FINALIZADO.** El canal se auto-destruirá en 10 segundos para limpiar la base de datos.');
                
                // Enviar copia al usuario por MD si es posible
                try {
                    const userEmbed = new EmbedBuilder()
                        .setColor('#3498DB')
                        .setTitle('🏛️ Tu ticket en Anda RP ha sido cerrado')
                        .setDescription(`Tu solicitud en el canal \`${channel.name}\` ha finalizado.\n\n**Resolución:** ${resolucion}`)
                        .setFooter({ text: 'Gracias por contactar con el soporte de Anda RP.' });
                    
                    const ticketOwner = await guild.members.fetch(interaction.user.id).catch(() => null);
                    if (ticketOwner) await ticketOwner.send({ embeds: [userEmbed] });
                } catch (e) { console.log("No se pudo enviar MD al usuario."); }

                setTimeout(() => channel.delete().catch(() => {}), 10000);

            } catch (e) {
                console.error("❌ ERROR CRÍTICO EN FASE DE CIERRE:", e);
                await channel.delete().catch(() => {});
            }
        }

        // --- G. ACCIÓN: COMPRAS (LOGS ADICIONALES) ---
        if (customId === 'ticket_compras') {
            await interaction.deferUpdate();
            await channel.setParent(catComprasId, { lockPermissions: false });
            
            // Permisos específicos para el rol de ventas
            await channel.permissionOverwrites.edit(rolComprasId, { 
                ViewChannel: true, 
                SendMessages: true, 
                ReadMessageHistory: true, 
                AttachFiles: true 
            });
            
            const bankEmbed = new EmbedBuilder()
                .setColor('#F1C40F')
                .setTitle('💰 DEPARTAMENTO DE VENTAS Y DONACIONES')
                .setDescription('Has sido transferido al área contable. Un encargado de finanzas revisará tu solicitud de compra o beneficio VIP.');
            
            await channel.send({ content: `<@&${rolComprasId}>`, embeds: [bankEmbed] });
        }
    }
};

/**
 * ---------------------------------------------------------
 * 📊 NOTAS TÉCNICAS Y CONTROL DE CALIDAD
 * ---------------------------------------------------------
 * - Versión del Script: 5.0.2
 * - Total de líneas estimadas: 460+
 * - Dependencias: discord.js, firebase-admin, discord-html-transcripts.
 * - Soporte Multi-Categoría: ✅
 * - Detección VIP Automática: ✅
 * - Escalado de Staff: ✅
 * ---------------------------------------------------------
 */