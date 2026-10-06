import {Component, OnInit, ViewChild} from '@angular/core';

import {CheckIn} from '@app/_models';
import {AuthenticationService, DataService} from '@app/_services';
import {MatTableDataSource} from '@angular/material/table';
import {MatPaginator} from '@angular/material/paginator';
import {MatSort} from '@angular/material/sort';
import {interval} from 'rxjs';
import {WooComerceEvent} from '@app/_models/event';
import {Ticket} from '@app/_models/ticket';
import * as XLSX from 'xlsx';
import {MatDialog} from '@angular/material/dialog';
import {EditDialog} from '@app/home/edit-dialog/edit.dialog';
import {CheckinDialog} from '@app/home/ticket-dialog/checkin.dialog';
import {AppConfigService} from "@app/app-config.service";

@Component({templateUrl: 'home.component.html', styleUrls: ['home.component.scss', 'mat-table-responsive/mat-table-responsive.directive.scss']})
export class HomeComponent implements OnInit {
  displayedColumns: string[] = ['ticketId', 'name', 'status', 'time'];
  ticketDisplayedColumns: string[] = ['ticketId', 'attendeeName', 'attendeeId', 'accompanist', 'status', 'variation'];
  dataSource: MatTableDataSource<CheckIn>;
  ticketDataSource: MatTableDataSource<Ticket>;
  search = '';
  search2 = '';
  editMode = false;
  adminMode = (localStorage.getItem('admin') == 'true');
  onlineOffline: boolean;
  pass = "";


  @ViewChild('TableOnePaginator', {static: true}) tableOnePaginator: MatPaginator;
  @ViewChild('TableOneSort', {static: true}) tableOneSort: MatSort;
  @ViewChild('TableTwoPaginator', {static: true}) tableTwoPaginator: MatPaginator;
  @ViewChild('TableTwoSort', {static: true}) tableTwoSort: MatSort;

  loading = false;
  checkIns: CheckIn[] = [];
  checkedIn: number;
  checkedIn5: number;
  ticketCouponSum: number;
  ticketStatistics: { [key: string]: number } = {};
  lastCheck = 0;
  autoRefresh = false;
  event: WooComerceEvent;

  constructor(private dataService: DataService, private authenticationService: AuthenticationService, public dialog: MatDialog, public configService: AppConfigService) { }

  ngOnInit(): void  {
    this.hardReload();

    interval(15 * 1000)
      .subscribe(() => { if (this.autoRefresh) { this.loadData(); } });
    interval(30 * 60 * 1000)
      .subscribe(() => { if (this.autoRefresh) { this.hardReload(); } });
  }

  applyFilter() {
    const filterValue = this.search;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  applyFilter2() {
    const filterValue = this.search2;
    this.ticketDataSource.filter = filterValue.trim().toLowerCase();

    if (this.ticketDataSource.paginator) {
      this.ticketDataSource.paginator.firstPage();
    }
  }

  calculateLast5() {
    const fromDate = new Date().getTime() / 1000 + 2 * 60 * 60 - 5 * 60;

    this.checkedIn5 = this.checkIns.filter( element => element.time > fromDate && element.status === 'Checked In' ).length;
    this.checkedIn5 -= this.checkIns.filter( element => element.time > fromDate && element.status !== 'Checked In' ).length;
  }

  calculate(checkIn: CheckIn) {
    const ticket = this.event.eventTickets.find(element =>  element.WooCommerceEventsTicketID === checkIn.wooCommerceEventsTicketID);
    if (ticket.WooCommerceEventsStatus === checkIn.status) {
      return;
    }

    if (checkIn.status === 'Checked In') {
      this.checkedIn++;
    } else if (ticket.WooCommerceEventsStatus === 'Checked In') {
      this.checkedIn--;
    }

    ticket.WooCommerceEventsStatus = checkIn.status;
  }

  loadData(calculate: boolean = true) {
    this.loading = true;
    this.dataService.getCheckIns(this.lastCheck, this.event.WooCommerceEventsProductID).subscribe(data => {
      // @ts-ignore
      if (data.message === false) {
        this.authenticationService.logout();
        return;
      }
      data.forEach(checkIn => {
        if (!this.checkIns.includes(checkIn)) {
          checkIn.time = checkIn.time - 2 * 60 * 60;
          this.checkIns.push(checkIn);
          if (calculate) {
            this.calculate(checkIn);
          }
        }
      });
      this.lastCheck = new Date().getTime() / 1000 + 2 * 60 * 60;
      this.dataSource = new MatTableDataSource(this.checkIns);
      this.dataSource.paginator = this.tableOnePaginator;
      this.dataSource.sort = this.tableOneSort;
      this.applyFilter();
      this.loading = false;
      this.onlineOffline = false;
      this.calculateLast5();
    }, () => {
      this.onlineOffline = true;
    });
  }

  hardReload() {
    this.loading = true;

    this.dataService.getAll().subscribe(data => {
      // init
      this.checkIns = [];
      this.checkedIn = 0;
      this.checkedIn5 = 0;
      this.ticketCouponSum = 0;
      this.ticketStatistics = {};
      this.lastCheck = 0;

      if (data.message === false) {
        this.authenticationService.logout();
        return;
      }

      this.event = data[0];

      this.event.eventTickets.forEach(ticket => {
        if (ticket.WooCommerceEventsStatus === 'Checked In') {
          this.checkedIn++;
        }

        const variationId = ticket.WooCommerceEventsVariationID;

        if (!this.ticketStatistics[variationId]) {
          this.ticketStatistics[variationId] = 0;
        }
        this.ticketStatistics[variationId]++;


        ticket.attendeeId = ticket.WooCommerceEventsCustomAttendeeFields['Fényképes igazolvány szám / ID number'];
        ticket.attendeeName = ticket.WooCommerceEventsCustomAttendeeFields['Név / Name'];
        ticket.accompanist = ticket.WooCommerceEventsCustomAttendeeFields['Kísért személy neve / Name of accompanied person'];
        ticket.WooCommerceEventsCustomAttendeeFields = null;
      });
      this.ticketDataSource = new MatTableDataSource(this.event.eventTickets);
      this.ticketDataSource.paginator = this.tableTwoPaginator;
      this.ticketDataSource.sort = this.tableTwoSort;
      this.applyFilter2();

      this.loadData(false);
    }, () => {
      this.onlineOffline = true;
    });
  }

  updateStatus(ticket: Ticket, status: string) {
    this.dataService.updateStatus(ticket.WooCommerceEventsTicketID, status).subscribe(() => {
      ticket.WooCommerceEventsStatus = status;
    });
  }

  deleteTestTickets() {
    this.dataService.deleteTestTickets().subscribe(data => {
      console.log('delete test tickets ' + data);
      this.hardReload();
    });
  }

  exportExcel() {
    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(this.event.eventTickets);
    const ws2: XLSX.WorkSheet = XLSX.utils.json_to_sheet(this.checkIns);

    /* generate workbook and add the worksheet */
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tickets');
    XLSX.utils.book_append_sheet(wb, ws2, 'Check In');

    /* save to file */
    XLSX.writeFile(wb, 'tickets_' + new Date().toLocaleTimeString() + '.xlsx');

  }

  openEditDialog(ticket: Ticket) {
    const dialogRef = this.dialog.open(EditDialog, {
      width: '400px',
      data: {ticket: ticket},
    });

    dialogRef.afterClosed().subscribe(result => {
      console.log('The dialog was closed');
      ticket = result;
    });
  }

  openCheckinDialog() {
    this.dialog.open(CheckinDialog, {
      width: '100%',
      maxWidth: '800px',
      data: {tickets: this.ticketDataSource.data},
    });
  }

  modifyEventPass() {
    this.dataService.modifyEventPass(this.event.WooCommerceEventsProductID, this.pass).subscribe(data => {
      console.log('modified event pass ' + data);
    });
  }

  objectKeys = Object.keys;
}
