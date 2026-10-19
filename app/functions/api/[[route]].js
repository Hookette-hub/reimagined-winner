/* Cloudflare Pages Functions : toutes les adresses /api/… vont au relais des notifications. */
import {traiter} from "../../relais/relais.js";

export const onRequest = ctx => traiter(ctx.request, ctx.env);
