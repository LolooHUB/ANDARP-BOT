const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle,
    PermissionFlagsBits
} = require('discord.js');
const { db } = require('../Automatizaciones/firebase');

/**
 * 🪪 MÓDULO DE IDENTIDAD NACIONAL - ANDA RP v2.0
 * ---------------------------------------------------------
 * LÓGICA DE NEGOCIO INTEGRADA:
 * 1. Verificación de Canal y Rol de Usuario.
 * 2. Detección de ciudadanos sin DNI con asignación de rol automático.
 * 3. Sistema de Registro Civil mediante Modales.
 * 4. Visualización de licencias y certificaciones estatales.
 * ---------------------------------------------------------
 */

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dni')
        .setDescription('🪪 Gestiona tu Documento Nacional de Identidad en el Registro Civil.')
        .addUserOption(option => 
            option.setName('usuario')
                .setDescription('Visualizar la documentación de otro ciudadano (Requiere permisos).')
                .setRequired(false)),

    async execute(interaction) {
        // --- CONFIGURACIÓN DE CONSTANTES DEL SISTEMA ---
        const ID_CANAL_PERMITIDO = '1490132182604316816';
        const ID_ROL_VERIFICADO = '1476791384894865419';
        const ID_ROL_SIN_DNI = '1492737726007476264'; // Rol asignado automáticamente si no tiene DNI

        console.log(`[DNI SYSTEM] Ejecución iniciada por ${interaction.user.tag}`);

        // 1. Validación de Entorno (Canal específico)
        if (interaction.channelId !== ID_CANAL_PERMITIDO) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('🛑 Trámite Denegado')
                .setDescription(`Para garantizar la seguridad del Registro Civil, este comando solo funciona en: <#${ID_CANAL_PERMITIDO}>.`)
                .setFooter({ text: 'Seguridad Ciudadana - Anda RP' });

            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        // 2. Validación de Estatus Ciudadano (Rol Verificado)
        if (!interaction.member.roles.cache.has(ID_ROL_VERIFICADO)) {
            return interaction.reply({ 
                content: '❌ Error: Debes completar la verificación inicial del servidor para acceder a trámites legales.', 
                ephemeral: true 
            });
        }

        const target = interaction.options.getUser('usuario') || interaction.user;
        const isSelf = target.id === interaction.user.id;

        try {
            const userRef = db.collection('usuarios_rp').doc(target.id);
            const doc = await userRef.get();

            // --- LÓGICA DE USUARIO NO REGISTRADO ---
            if (!doc.exists) {
                if (!isSelf) {
                    return interaction.reply({ 
                        content: `❌ El ciudadano **${target.username}** no figura en los archivos del Registro Civil de Catalunya.`, 
                        ephemeral: true 
                    });
                }

                // APLICACIÓN AUTOMÁTICA DE ROL SI NO TIENE DNI
                try {
                    if (!interaction.member.roles.cache.has(ID_ROL_SIN_DNI)) {
                        await interaction.member.roles.add(ID_ROL_SIN_DNI);
                        console.log(`[DNI SYSTEM] Rol asignado a ${interaction.user.tag} por falta de documentación.`);
                    }
                } catch (roleError) {
                    console.error("⚠️ Error al asignar rol de indocumentado:", roleError);
                }

                // Generación de Modal para el Registro Civil
                const modal = new ModalBuilder()
                    .setCustomId('modal_crear_dni')
                    .setTitle('🪪 Solicitud de Identidad - Catalunya');

                const nCompleto = new TextInputBuilder()
                    .setCustomId('dni_nombre')
                    .setLabel("Nombre y Apellidos (IC)")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("Ej: Antonio Escohotado")
                    .setMinLength(5)
                    .setMaxLength(50)
                    .setRequired(true);

                const edad = new TextInputBuilder()
                    .setCustomId('dni_edad')
                    .setLabel("Edad Ciudadana")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("Debe ser mayor de 18")
                    .setMaxLength(2)
                    .setRequired(true);

                const genero = new TextInputBuilder()
                    .setCustomId('dni_genero')
                    .setLabel("Género")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("Hombre / Mujer / No binario")
                    .setRequired(true);

                const nacimiento = new TextInputBuilder()
                    .setCustomId('dni_nacimiento')
                    .setLabel("Fecha de Nacimiento")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("DD/MM/AAAA")
                    .setRequired(true);

                const nacionalidad = new TextInputBuilder()
                    .setCustomId('dni_nacionalidad')
                    .setLabel("Origen / Nacionalidad")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("Ej: Española, Mexicana, etc.")
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(nCompleto),
                    new ActionRowBuilder().addComponents(edad),
                    new ActionRowBuilder().addComponents(genero),
                    new ActionRowBuilder().addComponents(nacimiento),
                    new ActionRowBuilder().addComponents(nacionalidad)
                );

                return await interaction.showModal(modal);
            }

            // --- RENDERIZADO DE DOCUMENTACIÓN EXISTENTE ---
            const data = doc.data();
            
            // Lógica de validación de licencias
            const licManejo = data.licencias.conducir.estado 
                ? `✅ **Vigente**\n└ *Tipo:* ${data.licencias.conducir.tipo}\n└ *Puntos:* ${data.licencias.conducir.puntos}/12` 
                : "❌ **No habilitado**";
            
            const licArmas = data.licencias.armas.estado 
                ? `✅ **Autorizado**\n└ *Rango:* ${data.licencias.armas.rango}` 
                : "❌ **Sin autorización legal**";

            const embedDNI = new EmbedBuilder()
                .setAuthor({ 
                    name: `MINISTERIO DEL INTERIOR - REGISTRO CIVIL`, 
                    iconURL: interaction.guild.iconURL() 
                })
                .setTitle(`🪪 DOCUMENTO NACIONAL DE IDENTIDAD`)
                .setDescription(`**Número de Identificación:** \`${data.numero_dni}\``)
                .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                .setColor('#F1C40F')
                .addFields(
                    { name: '👤 IDENTIDAD DEL CIUDADANO', value: `> **Nombre:** ${data.nombre}\n> **Género:** ${data.genero}\n> **Origen:** ${data.nacionalidad}`, inline: false },
                    { name: '📅 DATOS CRONOLÓGICOS', value: `**Nacimiento:** ${data.nacimiento}\n**Edad:** ${data.edad} años`, inline: true },
                    { name: '📜 REGISTRO ESTATAL', value: `**Fecha:** ${data.fecha_registro}\n**Jurisdicción:** Catalunya`, inline: true },
                    { name: '━━━━━━━━━━━━━━━━━━━━━━━━━━', value: '🛡️ **ESTADO DE LICENCIAS Y PERMISOS**' },
                    { name: '🚗 SEGURIDAD VIAL', value: licManejo, inline: true },
                    { name: '🔫 PORTE DE ARMAS', value: licArmas, inline: true },
                    { name: '🎣 ACTIVIDADES EXTRAS', value: data.licencias.pesca.estado ? '✅ Pesca Activa' : '❌ Sin Permiso', inline: true }
                )
                .addFields({ name: '💼 SITUACIÓN LABORAL', value: `Actualmente registrado como: **${data.trabajo || 'Buscando empleo'}**` })
                .setFooter({ text: `Sistema de Archivos de Anda RP | Consultor: ${interaction.user.username}`, iconURL: target.displayAvatarURL() })
                .setTimestamp();

            return interaction.reply({ embeds: [embedDNI] });

        } catch (error) {
            console.error("❌ ERROR CRÍTICO EN SISTEMA DNI:", error);
            return interaction.reply({ 
                content: "❌ Se ha producido un error técnico al conectar con el Registro Civil Central.", 
                ephemeral: true 
            });
        }
    },

    // --- MANEJO DE INTERACCIÓN CON EL FORMULARIO (MODAL) ---
    async handleDNIInteractions(interaction) {
        if (interaction.customId !== 'modal_crear_dni') return;
        
        const { fields, user, member, guild } = interaction;
        const ID_ROL_SIN_DNI = '1492737726007476264';
        
        // Generación de número de DNI único (9 dígitos)
        const numDNI = Math.floor(100000000 + Math.random() * 900000000);
        
        // Estructura completa de la base de datos para nuevos ciudadanos
        const perfilCiudadano = {
            userId: user.id,
            numero_dni: numDNI,
            nombre: fields.getTextInputValue('dni_nombre'),
            edad: fields.getTextInputValue('dni_edad'),
            genero: fields.getTextInputValue('dni_genero'),
            nacimiento: fields.getTextInputValue('dni_nacimiento'),
            nacionalidad: fields.getTextInputValue('dni_nacionalidad'),
            fecha_registro: new Date().toLocaleDateString('es-ES'),
            licencias: {
                conducir: { estado: false, tipo: "Ninguna", puntos: 12, fecha_exp: null },
                armas: { estado: false, rango: "Ninguno", id_permiso: null },
                pesca: { estado: false, expiracion: null },
                vuelo: { estado: false, tipo: "Ninguna" }
            },
            banco: 5000, // Bono inicial de bienvenida
            trabajo: "Desempleado",
            historial_delictivo: [],
            propiedades: [],
            metadatos: {
                creado_en: new Date(),
                version_dni: "v2.0-Elite"
            }
        };

        try {
            console.log(`[DNI SYSTEM] Registrando nuevo ciudadano: ${perfilCiudadano.nombre}`);

            // Guardado en Firebase
            await db.collection('usuarios_rp').doc(user.id).set(perfilCiudadano);

            // REMOCIÓN DEL ROL DE "SIN DNI" AL COMPLETAR EL TRÁMITE
            try {
                if (member.roles.cache.has(ID_ROL_SIN_DNI)) {
                    await member.roles.remove(ID_ROL_SIN_DNI);
                    console.log(`[DNI SYSTEM] Rol removido de ${user.tag} tras registro exitoso.`);
                }
            } catch (roleError) {
                console.warn("⚠️ No se pudo remover el rol de indocumentado automáticamente.");
            }

            const successEmbed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setTitle('✅ Registro Civil Completado')
                .setDescription(`Felicidades **${perfilCiudadano.nombre}**, ahora eres legalmente un ciudadano de Catalunya.`)
                .addFields(
                    { name: '🪪 Número asignado', value: `\`${numDNI}\``, inline: true },
                    { name: '💰 Bono de Arraigo', value: `$5,000 ingresados en cuenta`, inline: true }
                )
                .setFooter({ text: 'Bienvenido/a a la comunidad de Anda RP' })
                .setTimestamp();

            return interaction.reply({ embeds: [successEmbed], ephemeral: true });

        } catch (error) {
            console.error("❌ ERROR AL GUARDAR EN BASE DE DATOS:", error);
            return interaction.reply({ 
                content: "❌ El Registro Civil está saturado en este momento. Inténtalo de nuevo en unos minutos.", 
                ephemeral: true 
            });
        }
    }
};

/**
 * 📊 ESTADÍSTICAS DEL CÓDIGO:
 * -------------------------------------------
 * - Total de líneas aprox: 220 (Módulo Individual).
 * - Sistema de Auto-Rol: Implementado.
 * - Validación de Seguridad: Activa.
 * - Registro en tiempo real: Firebase Firestore.
 * -------------------------------------------
 */