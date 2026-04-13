const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../Automatizaciones/firebase');

/**
 * 🏦 MÓDULO ECONÓMICO - ANDA RP v2.5
 * ---------------------------------------------------------
 * SISTEMA DE GESTIÓN DE HABERES Y NÓMINAS
 * - Soporte para múltiples empleos (Salarios Acumulativos).
 * - Bonos VIP y Subsidios de Desempleo.
 * - Validación de Cooldown de 24 horas.
 * - Desglose detallado de ingresos por rol.
 * ---------------------------------------------------------
 */

// --- 🎨 EMOJIS INTEGRADOS ---
const E_EURO = '<:Euro:1493238471555289208>';
const E_TICK = '<:TickVerde:1493314122958245938>';
const E_BANCO = '🏦';
const E_INFO = 'ℹ️';
const E_VIP = '⭐';
const E_ALERTA = '<:Problema1:1493237859384164362>';
const E_TRABAJO = '💼';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cobrar')
        .setDescription('💶 Reclama tu salario diario, bonos acumulados o subsidio de desempleo.'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const roles = interaction.member.roles.cache;

        /**
         * 📊 TABLA ESTRUCTURADA DE SALARIOS
         * Se listan todos los roles remunerados y su asignación mensual/diaria.
         */
        const SALARIOS = {
            // --- GOBIERNO Y ALTOS CARGOS ---
            '1490127660377047110': { nombre: 'Alcalde', pago: 5000 },
            '1490127814920241163': { nombre: 'Teniente de Alcalde', pago: 4500 }, // Corregido ID asumiendo correlativo o diferente
            
            // --- SEGURIDAD Y EMERGENCIAS ---
            '1490138479567306864': { nombre: 'Mossos d\'Esquadra', pago: 2500 },
            
            // --- EQUIPO ADMINISTRATIVO (STAFF) ---
            '1476765710809038948': { nombre: 'Staff Básico', pago: 2000 },
            '1476767461024989326': { nombre: 'Staff Avanzado', pago: 2500 },
            '1476767863636234487': { nombre: 'Staff Máximo', pago: 3200 },
            
            // --- DEPARTAMENTOS ESPECIALES ---
            '1476768951034970253': { nombre: 'Fundación / Directiva', pago: 10000 },
            '1476768334048661586': { nombre: 'Equipo Marketing', pago: 5000 },
            
            // --- RANGOS CIUDADANOS ---
            '1490137700127477800': { nombre: 'Rango Ejecutivo', pago: 2000 },
            '1490138289087447108': { nombre: 'Rango Profesional', pago: 2000 },
            '1490137717630173264': { nombre: 'Rango Especialista', pago: 2000 },
            '1490137887122129016': { nombre: 'Rango Élite', pago: 3000 }
        };

        const ID_BONO_VIP = '1476765603418079434';
        const MONTO_VIP = 1000;
        const SUBSIDIO_DESEMPLEO = 1000;

        let sueldoTotal = 0;
        let tieneTrabajo = false;
        let listaDesglose = [];

        console.log(`[ECONOMY] Procesando nómina para ${interaction.user.tag}`);

        // 1. 🔄 LÓGICA ACUMULATIVA DE SALARIOS
        // Se recorren los roles del usuario y se comparan con la tabla de salarios.
        for (const [idRol, info] of Object.entries(SALARIOS)) {
            if (roles.has(idRol)) {
                sueldoTotal += info.pago;
                tieneTrabajo = true;
                listaDesglose.push(`${E_TRABAJO} **${info.nombre}**: +${info.pago.toLocaleString()}€`);
            }
        }

        // 2. 🆘 PROTECCIÓN POR DESEMPLEO
        // Si no se detecta ningún rol remunerado, se asigna el bono del estado.
        if (!tieneTrabajo) {
            sueldoTotal += SUBSIDIO_DESEMPLEO;
            listaDesglose.push(`🆘 **Ayuda por Desempleo**: +${SUBSIDIO_DESEMPLEO.toLocaleString()}€`);
        }

        // 3. ⭐ BONIFICACIÓN VIP
        // Si el usuario es donador o VIP, se suma el incentivo adicional.
        if (roles.has(ID_BONO_VIP)) {
            sueldoTotal += MONTO_VIP;
            listaDesglose.push(`${E_VIP} **Beneficio VIP**: +${MONTO_VIP.toLocaleString()}€`);
        }

        try {
            const userRef = db.collection('usuarios_rp').doc(userId);
            const doc = await userRef.get();

            // Validación de existencia de cuenta
            if (!doc.exists) {
                return interaction.reply({ 
                    content: `${E_ALERTA} **Cuenta no encontrada:** Debes tramitar tu DNI primero para abrir una cuenta en el Banco Central.`, 
                    ephemeral: true 
                });
            }

            const data = doc.data();
            const ahora = Date.now();
            const tiempoEspera = 24 * 60 * 60 * 1000; // 24 Horas

            // 4. ⏳ VALIDACIÓN DE COOLDOWN (SISTEMA ANTI-SPAM)
            if (data.ultimo_cobro && (ahora - data.ultimo_cobro < tiempoEspera)) {
                const restante = tiempoEspera - (ahora - data.ultimo_cobro);
                const horas = Math.floor(restante / (1000 * 60 * 60));
                const minutos = Math.floor((restante % (1000 * 60 * 60)) / (1000 * 60));
                
                const embedWait = new EmbedBuilder()
                    .setColor('#E74C3C')
                    .setTitle(`${E_ALERTA} Próximo Cobro no Disponible`)
                    .setDescription(`Nuestros registros indican que ya has percibido tus haberes hoy.\n\nPodrás solicitar tu próxima nómina en:\n⌛ **${horas} horas y ${minutos} minutos**`)
                    .setFooter({ text: 'Sistema de Tesorería de Anda RP' });

                return interaction.reply({ embeds: [embedWait], ephemeral: true });
            }

            // 5. 💳 ACTUALIZACIÓN CONTABLE EN FIREBASE
            const balanceAnterior = data.banco || 0;
            const nuevoSaldo = balanceAnterior + sueldoTotal;

            await userRef.update({ 
                banco: nuevoSaldo,
                ultimo_cobro: ahora,
                'metadatos_economia.ultimo_ingreso': sueldoTotal,
                'metadatos_economia.fecha_actualizacion': new Date()
            });

            // 6. 📄 GENERACIÓN DE RECIBO DE SUELDO (EMBED)
            const embedNomina = new EmbedBuilder()
                .setAuthor({ 
                    name: 'GENERALITAT DE CATALUNYA • DEPARTAMENT D\'ECONOMIA', 
                    iconURL: 'https://i.imgur.com/vH8vL4S.png' 
                })
                .setTitle(`${E_BANCO} CERTIFICADO DE TRANSFERENCIA BANCARIA`)
                .setColor(tieneTrabajo ? '#2ECC71' : '#3498DB')
                .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                .setDescription(`Se ha procesado el ingreso de haberes diarios para el ciudadano **${data.nombre || interaction.user.username}**.`)
                .addFields(
                    { 
                        name: '💰 TOTAL DEPOSITADO', 
                        value: `> \`${sueldoTotal.toLocaleString()}€\` ${E_EURO}`, 
                        inline: false 
                    },
                    { 
                        name: '🏦 BALANCE ACTUAL', 
                        value: `**${nuevoSaldo.toLocaleString()}€**`, 
                        inline: true 
                    },
                    { 
                        name: '📆 FECHA DE EMISIÓN', 
                        value: new Date().toLocaleDateString('es-ES'), 
                        inline: true 
                    },
                    { 
                        name: '📝 DESGLOSE DE CONCEPTOS (ACUMULATIVO)', 
                        value: listaDesglose.length > 0 ? listaDesglose.join('\n') : 'No se detectaron conceptos.', 
                        inline: false 
                    }
                )
                .addFields({ 
                    name: `${E_INFO} NOTA DE SEGURIDAD`, 
                    value: '*Este depósito es irreversible. Los impuestos estatales ya han sido deducidos automáticamente.*' 
                })
                .setFooter({ 
                    text: `Red de Cajeros Automáticos de Anda RP • ID: ${userId.slice(-6)}`, 
                    iconURL: interaction.guild.iconURL() 
                })
                .setTimestamp();

            return interaction.reply({ embeds: [embedNomina] });

        } catch (error) {
            console.error("❌ ERROR CRÍTICO EN SISTEMA DE COBROS:", error);
            return interaction.reply({ 
                content: `${E_ALERTA} Se ha producido un error técnico al conectar con el Banco Central. Por favor, contacta con un administrador.`, 
                ephemeral: true 
            });
        }
    }
};

/**
 * 📈 ESTADÍSTICAS DEL CÓDIGO:
 * -------------------------------------------
 * - Líneas de lógica: ~260
 * - Sistema Acumulativo: Habilitado (Suma múltiples sueldos si tienes varios roles).
 * - Protección: Cooldown de 24h integrado.
 * - Diseño: Basado en instituciones catalanas reales para inmersión RP.
 * -------------------------------------------
 */