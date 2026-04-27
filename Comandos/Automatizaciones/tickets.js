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
    Collection
} = require('discord.js');
const { db, getNextTicketId } = require('./firebase');
const transcripts = require('discord-html-transcripts');

/**
 * 🏛️ SISTEMA DE TICKETS ELITE PRO - ANDA RP v6.0 (SUPERIOR EDITION)
 * ---------------------------------------------------------
 * CONFIGURACIÓN DE SEGURIDAD Y PRECISIÓN
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
                    'Nuestro sistema de tickets garantiza una respuesta eficiente y privada.\n\n' +
                    '📡 **Soporte General:** Dudas técnicas, pérdida de items o soporte de cuenta.\n' +
                    '🚫 **Reportes:** Denuncias sobre infracciones a la normativa de convivencia.\n' +
                    '🤝 **Alianzas:** Consultas para comunidades externas o convenios especiales.\n' +
                    '👨‍⚖️ **Facciones:** Creación, gestión o dudas legales sobre organizaciones.\n\n' +
                    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
                    '⚠️ **DETECCIÓN AUTOMÁTICA VIP:**\n' +
                    '*Si posees beneficios de ciudadano, el sistema te asignará prioridad crítica.*'
                )
                .addFields(
                    { 
                        name: '🛡️ AUDITORÍA 24/7', 
                        value: 'Cada mensaje es registrado en nuestra base de datos cifrada.', 
                        inline: false 
                    },
                    { 
                        name: '⏱️ TIEMPOS DE RESPUESTA', 
                        value: '• **Usuario Estándar:** 12 a 24 horas.\n• **Usuario VIP:** Menos de 4 horas.', 
                        inline: true
                    }
                )
                .setImage('attachment://BannerTickets.png') 
                .setFooter({ text: 'Infraestructura de Soporte Anda RP 2026', iconURL: 'attachment://LogoPFP.png' })
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
            console.log(">>> [SISTEMA] PANEL PRINCIPAL DESPLEGADO CORRECTAMENTE");
        } catch (error) {
            console.error(">>> [ERROR] FALLO AL DESPLEGAR PANEL:", error);
        }
    },

    // --- 2. MANEJO DE INTERACCIONES (EL MOTOR DEL BOT) ---
    async handleTicketInteractions(interaction) {
        if (!interaction.guild) return;
        const { customId, guild, member, user, channel } = interaction;
        
        // --- CONFIGURACIÓN DE IDS Y ROLES ---
        const logChannelId = '1476799509207060551';
        const rolesVipIds = ['1494130913251168267', '1476765603418079434'];
        const catVipPrioridadId = '1489831182563672075';
        const catFaccionesId = '1491988211281559622';
        const pingNotificacionesId = '1476800914818859018';

        // JERARQUÍA MAESTRA PARA ASCENSOS
        const staffHierarchy = [
            '1476765837825277992', // [0] Helper
            '1476766248242118697', // [1] Mod en pruebas
            '1476766796861149284', // [2] Mod
            '1476767536530849822', // [3] Supervision basica
            '1476767750625038336', // [4] Administrador
            '1476768019496829033', // [5] Supervision Avanzada
            '1476768122915782676', // [6] Manager
            '1476800914818859018', // [7] Soporte Técnico / Notificador
            '1476768951034970253'  // [8] Fundacion
        ];

        const configs = {
            general: { cat: '1489831086065324093', role: staffHierarchy[0], prefix: 'soporte', n: 'Soporte General', emoji: '📡' },
            reporte: { cat: '1489831182563672075', role: staffHierarchy[1], prefix: 'reporte', n: 'Reportes', emoji: '🚫' },
            alianza: { cat: '1489831357357232218', role: staffHierarchy[6], prefix: 'alianza', n: 'Alianzas', emoji: '🤝' },
            facciones: { cat: catFaccionesId, role: staffHierarchy[5], prefix: 'fac', n: 'Facciones', emoji: '👨‍⚖️' }
        };

        // --- A. SOLICITUD DE MODALES (INICIO DE TRÁMITE) ---
        if (['t_general', 't_reporte', 't_alianza', 't_facciones'].includes(customId)) {
            const type = customId.replace('t_', '');
            
            // Verificación de Ticket Duplicado
            const existing = guild.channels.cache.find(c => 
                c.name.includes(configs[type].prefix) && c.permissionOverwrites.cache.has(user.id)
            );
            if (existing) {
                return interaction.reply({ 
                    content: `⚠️ Ya posees un ticket abierto para esta categoría: ${existing}`, 
                    flags: MessageFlags.Ephemeral 
                });
            }

            // Validación de acceso a Facciones
            if (customId === 't_facciones') {
                const canAccessFac = member.roles.cache.has('1476791384894865419') || member.permissions.has(PermissionFlagsBits.Administrator);
                if (!canAccessFac) {
                    return interaction.reply({ 
                        content: '🚫 Tu rango actual no permite gestionar facciones. Consulta <#1476790443919540367>.', 
                        flags: MessageFlags.Ephemeral 
                    });
                }
            }

            const modal = new ModalBuilder().setCustomId(`modal_t_${type}`).setTitle(`Formulario de ${configs[type].n}`);
            
            // Campos Dinámicos para evitar error de procesamiento
            const inputs = [];
            const addInput = (id, label, style, placeholder, required = true) => {
                inputs.push(new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setPlaceholder(placeholder).setRequired(required));
            };

            addInput('f_user', 'Nombre y Apellido In-game', TextInputStyle.Short, 'Ej: Juan_Perez');

            if (type === 'general') {
                addInput('f_motivo', 'Describe tu duda o problema', TextInputStyle.Paragraph, 'Explica detalladamente qué sucede...');
            } else if (type === 'reporte') {
                addInput('f_target', 'Usuario o ID Reportado', TextInputStyle.Short, 'Ej: ID 45 o Nombre_Usuario');
                addInput('f_razon', 'Contexto de la infracción', TextInputStyle.Paragraph, '¿Qué regla rompió?');
            } else if (type === 'alianza') {
                addInput('f_comu', 'Nombre de la Comunidad', TextInputStyle.Short, 'Nombre del proyecto/discord');
                addInput('f_prop', 'Propuesta Detallada', TextInputStyle.Paragraph, '¿Qué ofreces y qué buscas?');
            } else if (type === 'facciones') {
                addInput('f_fname', 'Nombre de la Organización', TextInputStyle.Short, 'Ej: Mafia Italiana / LSPD');
                addInput('f_ftype', 'Tipo de Facción', TextInputStyle.Short, 'Ej: Ilegal / Legal / Gubernamental');
                addInput('f_fhist', 'Breve Historia/Lore', TextInputStyle.Paragraph, 'Máximo 500 caracteres del origen.');
            }

            // Cada componente debe ir en su propia fila (Máximo 5 filas)
            const rows = inputs.map(input => new ActionRowBuilder().addComponents(input));
            modal.addComponents(rows);

            return await interaction.showModal(modal);
        }

        // --- B. CREACIÓN DE TICKET (PROCESAMIENTO POST-MODAL) ---
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
                    topic: `Ticket de ${user.tag} | ID: ${user.id} | Categoría: ${config.n}`,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory] },
                        { id: config.role, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                        { id: staffHierarchy[8], allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
                    ]
                });

                const welcomeEmbed = new EmbedBuilder()
                    .setColor(isVip ? '#F1C40F' : '#050505')
                    .setTitle(`${isVip ? '👑 ATENCIÓN PRIORITARIA VIP' : config.emoji + ' NUEVO EXPEDIENTE #' + ticketId}`)
                    .setDescription(`Estimado <@${user.id}>, tu solicitud ha sido recibida por el departamento de **${config.n}**.\n\n` +
                                    `**DATOS REGISTRADOS:**`)
                    .setFooter({ text: `Sistema de Gestión Anda RP | Canal ID: ${tChannel.id}` })
                    .setTimestamp();

                // Recolectar datos del modal para el embed
                interaction.fields.fields.forEach(f => {
                    const label = f.customId.replace('f_', '').toUpperCase();
                    welcomeEmbed.addFields({ name: `┃ ${label}`, value: `\`\`\`${f.value}\`\`\`` });
                });

                // Botones de Gestión
                const row1 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('ticket_reclamar').setLabel('Reclamar').setEmoji('📌').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('ticket_ascender').setLabel('Ascender Rango').setEmoji('🚀').setStyle(ButtonStyle.Primary)
                );
                const row2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('ticket_notificar').setLabel('Notificar Usuario').setEmoji('🔔').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('ticket_cerrar').setLabel('Cerrar Expediente').setEmoji('🔒').setStyle(ButtonStyle.Danger)
                );

                await tChannel.send({ 
                    content: `<@&${pingNotificacionesId}> ${isVip ? '⚠️ **ALERTA VIP DETECTADA**' : ''}`, 
                    embeds: [welcomeEmbed], 
                    components: [row1, row2] 
                });

                await interaction.editReply({ content: `✅ **Ticket creado exitosamente:** ${tChannel}` });

            } catch (err) {
                console.error("CRITICAL_ERROR_TICKET_CREATION:", err);
                await interaction.editReply({ content: '❌ Error crítico al crear el canal. Contacta a un Fundador.' });
            }
        }

        // --- C. RECLAMAR (NOTIFICACIONES Y LOGS LIMPIOS) ---
        if (customId === 'ticket_reclamar') {
            const isStaff = staffHierarchy.some(id => member.roles.cache.has(id));
            if (!isStaff) return interaction.reply({ content: '🚫 Acción denegada: No eres miembro del Staff.', flags: MessageFlags.Ephemeral });

            // Identificamos al usuario creador por permisos (el que no es staff ni everyone)
            const creator = channel.permissionOverwrites.cache.find(p => 
                p.type === 1 && !staffHierarchy.includes(p.id) && p.id !== guild.ownerId && p.id !== guild.id
            );

            const claimEmbed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setAuthor({ name: 'CASO RECLAMADO', iconURL: user.displayAvatarURL() })
                .setDescription(`🏛️ El miembro del staff **${user.username}** se ha hecho cargo de tu ticket.\n` +
                                `Por favor, mantén el respeto y espera las indicaciones.`)
                .setFooter({ text: 'Anda RP - Departamento de Atención' });

            // Ping al usuario en el canal, no al staff
            await interaction.reply({ content: creator ? `<@${creator.id}>` : '', embeds: [claimEmbed] });
            
            // Log de Auditoría sin pings molestos
            const logChan = guild.channels.cache.get(logChannelId);
            if (logChan) {
                logChan.send({ 
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#3498DB')
                            .setTitle('📌 TICKET RECLAMADO')
                            .addFields(
                                { name: 'Staff', value: `${user.tag} (${user.id})`, inline: true },
                                { name: 'Canal', value: `${channel.name}`, inline: true }
                            )
                            .setTimestamp()
                    ]
                });
            }
        }

        // --- D. SISTEMA DE ASCENSOS DINÁMICOS (LÓGICA ESCALONADA) ---
        if (customId === 'ticket_ascender') {
            const rolesEnCanal = staffHierarchy.filter(id => channel.permissionOverwrites.cache.has(id));
            // Obtenemos el rango más alto actualmente en el canal
            const idActual = rolesEnCanal[rolesEnCanal.length - 1];
            const indexActual = staffHierarchy.indexOf(idActual);

            let indexSiguiente;
            
            // Aplicación de la Lógica de Rangos:
            // SI ES HELPER (0), MOD EN PRUEBAS (1) O MOD (2) -> asciende a SUPERVISION BASICA (3)
            if (indexActual >= 0 && indexActual <= 2) {
                indexSiguiente = 3; 
            } 
            // Supervision basica (3) asciende a Administracion (4)
            else if (indexActual === 3) {
                indexSiguiente = 4;
            }
            // administracion (4) a supervision avanzada (5)
            else if (indexActual === 4) {
                indexSiguiente = 5;
            }
            // superv avanzada (5) a manager (6)
            else if (indexActual === 5) {
                indexSiguiente = 6;
            }
            // Manager (6) o superiores a fundacion (8)
            else if (indexActual >= 6 && indexActual < 8) {
                indexSiguiente = 8;
            }

            if (indexActual === 8 || !indexSiguiente) {
                return interaction.reply({ content: '⚠️ Este ticket ya se encuentra en el nivel máximo de jerarquía (Fundación).', flags: MessageFlags.Ephemeral });
            }

            const rolNuevo = staffHierarchy[indexSiguiente];
            
            try {
                // Dar acceso al nuevo rango
                await channel.permissionOverwrites.edit(rolNuevo, { 
                    ViewChannel: true, 
                    SendMessages: true, 
                    ReadMessageHistory: true 
                });
                
                // Restringir escritura al rango anterior para mantener orden
                if (idActual && idActual !== rolNuevo) {
                    await channel.permissionOverwrites.edit(idActual, { SendMessages: false });
                }

                await interaction.reply({ 
                    content: `🚀 **CASO ELEVADO:** El ticket ha sido escalado al departamento de <@&${rolNuevo}>.` 
                });

            } catch (error) {
                console.error("ASCENSO_ERROR:", error);
                await interaction.reply({ content: '❌ Error al modificar permisos del canal.', flags: MessageFlags.Ephemeral });
            }
        }

        // --- E. CIERRE, TRANSCRIPT E INTEGRACIÓN CON WEB ---
        if (customId === 'ticket_cerrar') {
            const isStaff = staffHierarchy.some(id => member.roles.cache.has(id));
            if (!isStaff) return interaction.reply({ content: '🚫 No tienes permiso para cerrar expedientes.', flags: MessageFlags.Ephemeral });

            const modal = new ModalBuilder().setCustomId('modal_pre_close').setTitle('Cierre de Expediente');
            const razon = new TextInputBuilder()
                .setCustomId('f_resolucion')
                .setLabel("Resolución y Conclusión")
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder("Explica brevemente cómo se resolvió el caso...")
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(razon));
            return await interaction.showModal(modal);
        }

        if (interaction.isModalSubmit() && customId === 'modal_pre_close') {
            await interaction.deferReply();
            
            const resolucion = interaction.fields.getTextInputValue('f_resolucion');
            const messages = await channel.messages.fetch();
            
            // --- CÁLCULO DE MÉTRICAS (QUIÉN PARTICIPÓ) ---
            const participants = new Collection();
            messages.forEach(m => {
                if (!m.author.bot) {
                    const count = participants.get(m.author.tag) || 0;
                    participants.set(m.author.tag, count + 1);
                }
            });

            const participantString = participants.map((cnt, tag) => `${tag}: ${cnt} msgs`).join(', ');

            // Generación de Transcript con Estilo Anda RP
            const attachment = await transcripts.createTranscript(channel, {
                limit: -1,
                fileName: `Transcript-${channel.name}.html`,
                saveImages: true,
                poweredBy: false,
                hydrate: true
            });

            const htmlContent = attachment.attachment.toString('utf-8');

            // --- GUARDADO EN FIREBASE (OPTIMIZADO PARA TU WEB) ---
            try {
                await db.collection('transcripts').doc(channel.name).set({
                    ticketId: channel.name,
                    closedBy: user.username,
                    closedAt: new Date(), // Firebase lo guarda como Timestamp automáticamente
                    resolution: resolucion,
                    creatorId: channel.topic?.split('|')[1]?.trim().split(':')[1]?.trim() || "Desconocido",
                    participants: participantString,
                    htmlContent: htmlContent, // IMPORTANTE: Así lo lee tu script index.html
                    server: "Anda RP Main"
                });

                // Notificación al Canal de Logs con Archivo
                const logChan = guild.channels.cache.get(logChannelId);
                if (logChan) {
                    const logEmbed = new EmbedBuilder()
                        .setColor('#E74C3C')
                        .setTitle('🔒 EXPEDIENTE FINALIZADO')
                        .addFields(
                            { name: 'Ticket', value: `\`${channel.name}\``, inline: true },
                            { name: 'Cerrado por', value: `${user.tag}`, inline: true },
                            { name: 'Resolución', value: `\`\`\`${resolucion}\`\`\`` },
                            { name: 'Participantes', value: participantString || 'Sin mensajes' }
                        )
                        .setTimestamp();

                    await logChan.send({ embeds: [logEmbed], files: [attachment] });
                }

                await interaction.editReply('✅ **EXPEDIENTE ARCHIVADO:** La transcripción ha sido subida a la nube y el canal se autodestruirá en 5 segundos.');
                
                // Efecto de autodestrucción
                setTimeout(() => channel.delete().catch(() => {}), 5000);

            } catch (dbError) {
                console.error("FIREBASE_SAVE_ERROR:", dbError);
                await interaction.editReply('⚠️ El ticket se cerrará, pero hubo un error al guardar en la web. El archivo físico se envió a logs.');
                setTimeout(() => channel.delete().catch(() => {}), 10000);
            }
        }

        // --- F. FUNCIÓN DE NOTIFICAR (AVISO RÁPIDO) ---
        if (customId === 'ticket_notificar') {
            const isStaff = staffHierarchy.some(id => member.roles.cache.has(id));
            if (!isStaff) return interaction.reply({ content: '🚫 No tienes permiso.', flags: MessageFlags.Ephemeral });

            const creator = channel.permissionOverwrites.cache.find(p => 
                p.type === 1 && !staffHierarchy.includes(p.id) && p.id !== guild.ownerId
            );

            if (creator) {
                await channel.send({ 
                    content: `<@${creator.id}>`,
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#F39C12')
                            .setDescription('🔔 **RECORDATORIO:** Se requiere tu presencia o respuesta en este ticket para poder continuar con el proceso.')
                    ]
                });
                await interaction.reply({ content: '✅ Notificación enviada.', flags: MessageFlags.Ephemeral });
            } else {
                await interaction.reply({ content: '❌ No se encontró al usuario creador.', flags: MessageFlags.Ephemeral });
            }
        }
    }
};

/**
 * NOTAS TÉCNICAS v6.0:
 * 1. El guardado en Firebase usa 'transcripts' como colección principal.
 * 2. La web debe buscar el documento por el ID que es el nombre del canal (ej: soporte-1).
 * 3. Se ha corregido la inyección de HTML para que incluya todos los estilos de Discord.
 * 4. El sistema de ascensos ahora es selectivo y no rompe si faltan roles intermedios.
 */