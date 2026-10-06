import {createServerFn} from "@tanstack/react-start";
import {z} from "zod";
import {requireSupabaseAuth} from "@/integrations/supabase/auth-middleware";
import {admin} from "@/build/services/adminAuth.server";
import {workshopCustomerCase,workshopCustomerDocument} from "./workshopCustomerCase.server";
const input=z.object({caseId:z.string().uuid()}).strict();
export const getMyWorkshopCustomerCase=createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).inputValidator((data:unknown)=>input.parse(data)).handler(async({context,data})=>workshopCustomerCase(await admin(),context.userId,data.caseId));
export const getMyWorkshopCustomerDocument=createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).inputValidator((data:unknown)=>input.extend({id:z.string().uuid(),kind:z.enum(["quote","invoice","credit"])}).strict().parse(data)).handler(async({context,data})=>workshopCustomerDocument(await admin(),context.userId,data.caseId,data.kind,data.id));
