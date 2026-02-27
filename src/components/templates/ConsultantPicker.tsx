import { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { UserService } from '@/services/users';
import type { User } from '@/types/organization';

interface ConsultantPickerProps {
  orgId: string;
  value: string;           // selected consultant uid
  onSelect: (uid: string, email: string, displayName: string) => void;
}

export function ConsultantPicker({ orgId, value, onSelect }: ConsultantPickerProps) {
  const [open, setOpen] = useState(false);
  const [consultants, setConsultants] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    UserService.getByOrganization(orgId)
      .then(users => setConsultants(users.filter(u => u.role === 'MEMBER' && u.status === 'ACTIVE')))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [orgId]);

  const selected = consultants.find(c => c.uid === value);
  const displayLabel = selected
    ? (selected.displayName || selected.email)
    : 'Select a consultant...';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <span className="truncate">{displayLabel}</span>
          {loading ? (
            <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin opacity-50" />
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0">
        <Command>
          <CommandInput placeholder="Search consultants..." />
          <CommandList>
            <CommandEmpty>
              {loading ? 'Loading...' : 'No field consultants found in this organization.'}
            </CommandEmpty>
            <CommandGroup>
              {consultants.map(consultant => (
                <CommandItem
                  key={consultant.uid}
                  value={consultant.displayName || consultant.email}
                  onSelect={() => {
                    onSelect(consultant.uid, consultant.email, consultant.displayName || consultant.email);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn('mr-2 h-4 w-4', value === consultant.uid ? 'opacity-100' : 'opacity-0')}
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {consultant.displayName || consultant.email}
                    </span>
                    {consultant.displayName && (
                      <span className="text-xs text-muted-foreground">{consultant.email}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
