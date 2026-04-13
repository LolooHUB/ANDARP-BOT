const { 
    SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ModalBuilder, 
    TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle, 
    StringSelectMenuBuilder, AttachmentBuilder, MessageFlags 
} = require('discord.js');
const { db } = require('../Automatizaciones/firebase');
const fs = require('fs');

/**
 * 🏎️ MÓDULO DE PARQUE AUTOMOVILÍSTICO - ANDA RP v6.0
 * ---------------------------------------------------------
 * MEJORAS DE ESTA VERSIÓN:
 * 1. Sistema Anti-Expiración: Uso de deferReply() en puntos críticos.
 * 2. Gestión de Memoria: Limpieza de adjuntos y validación de FS.
 * 3. Lógica de Cobro: Validación en tiempo real de fondos bancarios.
 * 4. UX: Feedback inmediato para evitar "Interacción fallida".
 * ---------------------------------------------------------
 */

// --- 🎨 EMOJIS INTEGRADOS ---
const E_AUTO = '<:AutoR:1493313156452454440>';
const E_CARRITO = '<:Carrito:1493313258059333852>';
const E_TICK = '<:TickVerde:1493314122958245938>';
const E_EURO = '<:Euro:1493238471555289208>';
const E_BAN = '<:Ban:1493314179631681737>';
const E_DOC = '<:Aprobado1:1493237545486516224>';
const E_ALERTA = '<:Problema1:1493237859384164362>';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vehiculo')
        .setDescription('🚗 Registrar o consultar vehículos del parque automovilístico.'),

    async execute(interaction) {
        const ID_CANAL_VEHICULOS = '1490146016207573062';
        const RUTA_LOGO = './attachments/LogoPFP.png';
        
        // 1. Validación de Canal Obligatoria
        if (interaction.channelId !== ID_CANAL_VEHICULOS) {
            return interaction.reply({ 
                content: `${E_ALERTA} **Protocolo Incorrecto:** Los trámites de la DGT se gestionan exclusivamente en <#${ID_CANAL_VEHICULOS}>.`, 
                flags: MessageFlags.Ephemeral 
            });
        }

        try {
            // Referencia a la base de datos
            const userRef = db.collection('usuarios_rp').doc(interaction.user.id);
            const doc = await userRef.get();

            // 2. Validación de Existencia de DNI
            if (!doc.exists) {
                return interaction.reply({ 
                    content: `${E_BAN} **Sin Identificación:** No apareces en el Registro Civil. Usa \`/dni\` antes de registrar un vehículo.`, 
                    flags: MessageFlags.Ephemeral 
                });
            }

            const data = doc.data();
            const vehiculosExistentes = data.propiedades || [];
            const esPrimerVehiculo = vehiculosExistentes.length === 0;

            // --- ESCENARIO A: EL USUARIO YA TIENE VEHÍCULOS (MOSTRAR MENÚ) ---
            if (!esPrimerVehiculo) {
                let files = [];
                let logoName = null;

                if (fs.existsSync(RUTA_LOGO)) {
                    const attachment = new AttachmentBuilder(RUTA_LOGO, { name: 'LogoPFP.png' });
                    files.push(attachment);
                    logoName = 'attachment://LogoPFP.png';
                }

                const embedMenu = new EmbedBuilder()
                    .setAuthor({ name: 'DGT - DEPARTAMENTO DE TRÁFICO', iconURL: logoName })
                    .setTitle(`${E_AUTO} GESTIÓN DE PROPIEDADES MOTORIZADAS`)
                    .setColor('#F1C40F')
                    .setThumbnail(logoName)
                    .setDescription(
                        'Bienvenido al sistema central de la DGT. Selecciona una acción en el menú inferior.\n\n' +
                        `${E_EURO} **TASAS DE MATRICULACIÓN:**\n` +
                        '• 👴 **Clásicos (< 2015):** 15,000€\n' +
                        '• ✨ **Modernos (2015+):** 22,000€\n\n' +
                        `${E_ALERTA} *El cobro se procesa automáticamente tras la aprobación de un Inspector de Tráfico.*`
                    )
                    .addFields({ 
                        name: '📊 TU GARAJE', 
                        value: `Tienes actualmente **${vehiculosExistentes.length}** vehículo(s) registrados.` 
                    })
                    .setFooter({ text: 'Anda RP - Seguridad Vial y Control Automotriz' })
                    .setTimestamp();

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('select_tramite_vehiculo')
                    .setPlaceholder('¿Qué trámite desea realizar?')
                    .addOptions([
                        { 
                            label: 'Matricular Nuevo Vehículo', 
                            value: 'opcion_nuevo', 
                            emoji: '🆕',
                            description: 'Iniciar proceso de alta para una nueva unidad.'
                        },
                        ...vehiculosExistentes.map((v, i) => ({
                            label: `${v.modelo}`.substring(0, 25),
                            value: `ver_${i}`,
                            emoji: '🚗',
                            description: `Matrícula: ${v.matricula}`
                        }))
                    ]);

                const row = new ActionRowBuilder().addComponents(selectMenu);
                return await interaction.reply({ 
                    embeds: [embedMenu], 
                    components: [row], 
                    files: files 
                });
            }

            // --- ESCENARIO B: PRIMER VEHÍCULO (IR DIRECTO AL MODAL) ---
            return await this.enviarModalRegistro(interaction, true);

        } catch (error) {
            console.error("🔴 Error Crítico en Execute Vehiculo:", error);
            return interaction.reply({ content: `${E_ALERTA} Error interno al conectar con la base de datos de la DGT.`, flags: MessageFlags.Ephemeral });
        }
    },

    async enviarModalRegistro(interaction, gratis = false) {
        const modal = new ModalBuilder()
            .setCustomId('modal_registro_vehiculo')
            .setTitle(gratis ? '🎁 REGISTRO DE BIENVENIDA' : '🚗 SOLICITUD DE MATRÍCULA');
        
        const inputModelo = new TextInputBuilder()
            .setCustomId('veh_modelo')
            .setLabel("Marca y Modelo Exacto")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Ej: BMW M4 Competition")
            .setRequired(true);

        const inputAnio = new TextInputBuilder()
            .setCustomId('veh_antiguedad')
            .setLabel("Año de Fabricación")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Ej: 2024")
            .setMaxLength(4)
            .setRequired(true);

        const inputColor = new TextInputBuilder()
            .setCustomId('veh_color')
            .setLabel("Color de Carrocería")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Ej: Negro Mate")
            .setRequired(true);

        const inputDesc = new TextInputBuilder()
            .setCustomId('veh_desc')
            .setLabel("Extras o Modificaciones")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("Describe si tiene blindaje, turbo, o es de serie...")
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(inputModelo),
            new ActionRowBuilder().addComponents(inputAnio),
            new ActionRowBuilder().addComponents(inputColor),
            new ActionRowBuilder().addComponents(inputDesc)
        );

        // Si la interacción ya fue respondida (por el select menu), usamos showModal normalmente
        // pero verificamos que no sea tarde.
        return await interaction.showModal(modal);
    },

    async handleVehiculoInteractions(interaction) {
        try {
            // --- 1. MANEJO DEL SELECT MENU ---
            if (interaction.isStringSelectMenu() && interaction.customId === 'select_tramite_vehiculo') {
                const valor = interaction.values[0];
                
                if (valor === 'opcion_nuevo') {
                    return await this.enviarModalRegistro(interaction, false);
                }
                
                // Si elige ver un vehículo existente
                const index = parseInt(valor.split('_')[1]);
                const doc = await db.collection('usuarios_rp').doc(interaction.user.id).get();
                const veh = doc.data().propiedades[index];

                const embedPapeles = new EmbedBuilder()
                    .setAuthor({ name: 'DGT - CERTIFICADO DE PROPIEDAD', iconURL: 'https://i.imgur.com/vH8vL4S.png' })
                    .setColor('#2ECC71')
                    .setTitle(`${E_DOC} Ficha Técnica: ${veh.modelo}`)
                    .addFields(
                        { name: '👤 Titular Legal', value: `> ${interaction.user.username}`, inline: true },
                        { name: '🆔 Matrícula', value: `> \`${veh.matricula}\``, inline: true },
                        { name: '🎨 Color', value: `> ${veh.color || 'Estándar'}`, inline: true },
                        { name: '📅 Fecha de Alta', value: `> ${veh.fecha_registro}`, inline: true }
                    )
                    .setFooter({ text: 'Este documento es válido como prueba de propiedad ante la policía.' })
                    .setTimestamp();

                return await interaction.reply({ embeds: [embedPapeles], flags: MessageFlags.Ephemeral });
            }

            // --- 2. MANEJO DEL ENVÍO DEL MODAL ---
            if (interaction.isModalSubmit() && interaction.customId === 'modal_registro_vehiculo') {
                // PRIMERO: Defer para ganar tiempo y evitar el "Interacción Fallida"
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                const { fields, user, guild } = interaction;
                const modelo = fields.getTextInputValue('veh_modelo');
                const anioStr = fields.getTextInputValue('veh_antiguedad');
                const anio = parseInt(anioStr);
                const color = fields.getTextInputValue('veh_color');
                const desc = fields.getTextInputValue('veh_desc');
                
                // Validar que el año sea un número
                if (isNaN(anio)) {
                    return await interaction.editReply({ content: `${E_ALERTA} **Error:** El año debe ser un número válido (ej: 2022).` });
                }

                const userRef = db.collection('usuarios_rp').doc(user.id);
                const doc = await userRef.get();
                const data = doc.data();
                const esGratis = (data.propiedades || []).length === 0;

                const precioBase = anio < 2015 ? 15000 : 22000;
                const costoFinal = esGratis ? 0 : precioBase;

                // Validar fondos si no es gratis
                if (!esGratis && (data.banco || 0) < costoFinal) {
                    return await interaction.editReply({ 
                        content: `${E_BAN} **Fondos Insuficientes:** El trámite cuesta **${costoFinal.toLocaleString()}€** ${E_EURO} y solo tienes **${(data.banco || 0).toLocaleString()}€** en el banco.` 
                    });
                }

                // Generar Matrícula (Formato: 1234-ABC)
                const num = Math.floor(1000 + Math.random() * 9000);
                const letras = "BCDFGHJKLMNPRSTVWXYZ";
                let randomLetras = "";
                for (let i = 0; i < 3; i++) randomLetras += letras.charAt(Math.floor(Math.random() * letras.length));
                const matricula = `${num}-${randomLetras}`;

                // Notificar al Staff
                const canalStaff = guild.channels.cache.get('1490132369175351397');
                if (!canalStaff) {
                    return await interaction.editReply({ content: `${E_ALERTA} Error: No se encontró el canal de revisión del staff.` });
                }

                const embedStaff = new EmbedBuilder()
                    .setTitle(esGratis ? `🎁 ${E_AUTO} SOLICITUD DE PRIMER VEHÍCULO (GRATIS)` : `🚀 ${E_CARRITO} NUEVA SOLICITUD DE MATRICULACIÓN`)
                    .setColor(esGratis ? '#2ECC71' : '#E67E22')
                    .setThumbnail(user.displayAvatarURL())
                    .addFields(
                        { name: '👤 Ciudadano', value: `<@${user.id}> (\`${user.id}\`)`, inline: true },
                        { name: '🚗 Vehículo', value: `${modelo} (${anio})`, inline: true },
                        { name: '🆔 Matrícula Generada', value: `\`${matricula}\``, inline: true },
                        { name: '🎨 Color Definido', value: color, inline: true },
                        { name: '💰 Costo del Trámite', value: `**${costoFinal.toLocaleString()}€** ${E_EURO}`, inline: true },
                        { name: '📝 Detalles/Extras', value: `\`\`\`${desc}\`\`\`` }
                    )
                    .setTimestamp();

                const botones = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`aprobar_veh_${user.id}_${matricula}_${modelo.replace(/ /g, '-')}_${costoFinal}_${color.replace(/ /g, '-')}`)
                        .setLabel(esGratis ? 'Aprobar Gratis' : `Cobrar ${costoFinal.toLocaleString()}€ y Aprobar`)
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('✅'),
                    new ButtonBuilder()
                        .setCustomId(`denegar_veh_${user.id}`)
                        .setLabel('Denegar Solicitud')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('✖️')
                );

                await canalStaff.send({ embeds: [embedStaff], components: [botones] });

                return await interaction.editReply({ 
                    content: `${E_TICK} **Trámite Iniciado:** Tu solicitud para el **${modelo}** ha sido enviada a los inspectores de la DGT. Recibirás una notificación cuando sea procesada.` 
                });
            }
        } catch (e) {
            console.error("🔴 Error en handleVehiculoInteractions:", e);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: `${E_ALERTA} Ocurrió un error procesando la solicitud.`, flags: MessageFlags.Ephemeral });
            }
        }
    },

    async handleButtons(interaction) {
        try {
            const [accion, tipo, targetId, matricula, modeloRaw, costoRaw, colorRaw] = interaction.customId.split('_');
            
            if (tipo !== 'veh') return; // Asegurar que solo maneje botones de vehículos

            if (accion === 'denegar') {
                return await interaction.update({ 
                    content: `${E_BAN} **Solicitud Rechazada:** El trámite para <@${targetId}> ha sido denegado por el inspector <@${interaction.user.id}>.`, 
                    embeds: [], 
                    components: [] 
                });
            }

            if (accion === 'aprobar') {
                await interaction.deferUpdate(); // Gana tiempo para DB

                const modelo = modeloRaw.replace(/-/g, ' ');
                const costo = parseInt(costoRaw);
                const color = colorRaw.replace(/-/g, ' ');

                const docRef = db.collection('usuarios_rp').doc(targetId);
                const doc = await docRef.get();
                
                if (!doc.exists) {
                    return await interaction.followUp({ content: `${E_ALERTA} Error: El usuario ya no existe en la DB.`, flags: MessageFlags.Ephemeral });
                }

                const data = doc.data();

                // Verificar una última vez si tiene dinero (por si lo gastó mientras esperaba)
                if (costo > 0 && (data.banco || 0) < costo) {
                    return await interaction.followUp({ content: `${E_ALERTA} El usuario ya no tiene dinero suficiente para este trámite.`, flags: MessageFlags.Ephemeral });
                }

                const nuevoVehiculo = {
                    matricula: matricula,
                    modelo: modelo,
                    color: color,
                    fecha_registro: new Date().toLocaleDateString('es-ES'),
                    registrado_por: interaction.user.tag
                };

                await docRef.update({
                    banco: (data.banco || 0) - costo,
                    propiedades: [...(data.propiedades || []), nuevoVehiculo]
                });

                // Notificar en el canal del staff
                await interaction.editReply({ 
                    content: `${E_TICK} **Trámite Finalizado:** Se ha registrado el **${modelo}** [\`${matricula}\`] a <@${targetId}>. Cobro: **${costo.toLocaleString()}€** ${E_EURO}.`, 
                    embeds: [], 
                    components: [] 
                });

                // Intentar notificar al usuario
                const user = await interaction.client.users.fetch(targetId).catch(() => null);
                if (user) {
                    user.send(`${E_AUTO} **DGT Informa:** Tu solicitud de matrícula para el **${modelo}** ha sido **APROBADA** ${E_TICK}. Ya puedes encontrarlo en tu garaje.`).catch(() => {});
                }
            }
        } catch (e) { 
            console.error("🔴 Error en handleButtons Vehículo:", e);
        }
    }
};